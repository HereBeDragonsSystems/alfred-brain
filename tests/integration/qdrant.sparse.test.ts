import { QdrantClient } from "@qdrant/js-client-rest";
import { DataToSparse, DenseVectors, SplitDocs } from "./dataToSparse";
import { randomUUID } from "crypto";
import { Pool } from "pg";
const collectionName = "dense_collection";
const tagCollection = "rag_terms";

jest.setTimeout(1000000);

describe("Qdrant Sparse Test", () => {
  let client: QdrantClient;
  let pool: Pool;
  beforeAll(async () => {
    client = new QdrantClient({
      url: "http://localhost:6333",
      apiKey: "api-key",
    });
    pool = new Pool({
      user: "alfred",
      password: "password",
      host: "localhost",
      port: 5432,
      database: "rag_db",
    });

    console.log("testing if collection exists");
    const exists = await client.collectionExists(collectionName);
    if (!exists.exists) {
      console.log("no collection, creating one");
      const response = await client.createCollection(collectionName, {
        vectors: {
          default: {
            distance: "Cosine",
            size: 768,
          },
        },
        sparse_vectors: {
          bm42: {
            modifier: "idf",
          },
        },
      });

      expect(response).toBeTruthy();
    } else {
      console.log("collection exists");
    }
  });

  afterAll(async () => {
    //   const exists = await client.collectionExists(collectionName);
    //   if (exists.exists) {
    //     const response = await client.deleteCollection(collectionName);
    //     expect(response).toBeTruthy();
    //   }
  });

  // it.only("does nothing", () => {
  it.skip("does nothing", () => {
    expect(true).toBeTruthy();
  });
  const docs = SplitDocs;

  const points = [];

  it("calculates vectors", () => {
    const inputData = DataToSparse;

    for (let i = 0; i < docs.length; i++) {
      const embed = DenseVectors[i];
      let bm42;
      try {
        bm42 = inputData[i].sparse;
      } catch (e) {
        console.log(`Error in item ${i}: $e}`);
        throw e;
      }

      points.push({
        id: randomUUID(),
        vector: {
          default: embed,
          bm42: bm42,
        },
        payload: {
          content: docs[i].pageContent,
          metadata: docs[i].metadata,
        },
      });
    }
  });

  it("Deletes old points", async () => {
    await client.delete(collectionName, {
      filter: {
        must: [
          {
            key: "metadata.title",
            match: { value: docs[0].metadata.title },
          },
        ],
      },
    });
  });

  it("creates/updates tags in the tag db", async () => {
    const client = await pool.connect();
    let res: any;
    try {
      const indicesSet = DataToSparse.reduce(
        (
          accum: { set: Set<string>; counter: Record<string, number> },
          term
        ) => {
          for (const t of term.sparse.indices) {
            if (!accum.set.has(t)) {
              accum.set.add(t);
            }
            accum.counter[t] = accum.counter[t] ? accum.counter[t] + 1 : 1;
          }

          return accum;
        },
        { set: new Set<string>(), counter: {} }
      );

      const indices = Array.from(indicesSet.set);
      const query = `WITH new_terms(term, language, ord, occ) AS (
        VALUES
        ${indices.map((term, i) => `('${term}', 'en', ${i}, ${indicesSet.counter[term]})`).join(",\n        ")}
      ),
      upserted AS (
       INSERT INTO rag_terms (term, language, occurrences)
        SELECT term, language, occ AS occurrences
        FROM new_terms
        ON CONFLICT (term)
          DO UPDATE
               SET occurrences = rag_terms.occurrences + EXCLUDED.occurrences
               RETURNING id, term, language
               )
      SELECT u.term, u.id
      FROM new_terms n
             JOIN upserted   u
                  ON u.term     = n.term
                    AND u.language = n.language
      ORDER BY n.ord;
      `;

      res = await client.query(query);
    } finally {
      client.release();
    }

    expect(res).toBeDefined();
  });

  it("replaces terms with their index", async () => {
    const client = await pool.connect();
    let res: any;
    try {
      const query =
        "WITH lookup_list(term, ord) AS (" +
        "  VALUES\n" +
        "    " +
        points
          .reduce((accum: string[], p) => {
            accum.push(...p.vector.bm42.indices);
            return accum;
          }, [])
          .map((term, i) => `('${term}', ${i})`)
          .join(",\n    ") +
        "\n)\n" +
        "SELECT t.term, t.id\n" +
        "FROM lookup_list l\n" +
        `JOIN ${tagCollection} t\n` +
        "  ON t.term     = l.term\n" +
        "ORDER BY l.ord;";

      res = await client.query(query);
    } finally {
      client.release();
    }

    const terms = res.rows.reduce((accum: Record<string, number>, obj) => {
      const { term, id } = obj;
      accum[term] = id;
      return accum;
    }, {});

    points.forEach((p) => {
      p.vector.bm42.indices = p.vector.bm42.indices.map((i) => {
        if (!terms[i]) {
          throw new Error(`There should be terms for ${i}`);
        }
        return terms[i];
      });
    });
  });

  it("Upserts points", async () => {
    try {
      const res = await client.upsert(collectionName, {
        points: points,
      });
    } catch (e: unknown) {
      console.log(`Error: ${e}`);
      throw e;
    }
    console.log("upsert");
  });
});
