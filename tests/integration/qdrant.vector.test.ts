import { QdrantClient } from "@qdrant/js-client-rest";
import { DataToSparse, DenseVectors, SplitDocs } from "./dataToSparse";
import { randomUUID } from "crypto";

const collectionName = "test-collection-dense";

jest.setTimeout(1000000);

describe("Qdrant", () => {
  let client: QdrantClient;

  beforeAll(async () => {
    client = new QdrantClient({
      url: "http://localhost:6333",
      apiKey: "api-key",
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
        // sparse_vectors: {
        //   bm42: {
        //     modifier: "idf",
        //   },
        // },
      });

      expect(response).toBeTruthy();
    } else {
      console.log("collection exists");
    }
  });

  afterAll(async () => {
    const exists = await client.collectionExists(collectionName);
    if (exists.exists) {
      const response = await client.deleteCollection(collectionName);
      expect(response).toBeTruthy();
    }
  });

  it.skip("does nothing", () => {
    // it.only("does nothing", () => {
    expect(true).toBeTruthy();
  });

  it("Upserts points with only Dense Vectors", async () => {
    const inputData = DataToSparse;

    console.log(inputData);

    // 3. Run document loader
    const docs = SplitDocs;

    if (docs.length !== inputData.length) {
      console.log(`docs: $docs.length}`);
      console.log(`input: ${inputData.length}`);
    } else {
      console.log("items match");
    }

    console.log("I have process all");
    // 4. generate points with sparse vectors
    const points = [];

    for (let i = 0; i < docs.length; i++) {
      const embed = DenseVectors[i];
      // let bm42;
      // console.log(`Input data ${i}: ${inputData[i]}`);
      // try {
      //   bm42 = inputData[i].sparse;
      // } catch (e) {
      //   console.log(`Error in item ${i}: $e}`);
      //   throw e;
      // }

      points.push({
        id: randomUUID(),
        vector: {
          default: embed,
          // bm42: bm42,
        },
        payload: {
          content: docs[i].pageContent,
          metadata: docs[i].metadata,
        },
      });
    }

    console.log("vectors");

    // // 5. Delete existing vectors by title
    // await client.delete(collectionName, {
    //   filter: {
    //     must: [
    //       {
    //         key: "metadata.title",
    //         match: { "value": docs[0].metadata.title }
    //       }
    //     ]
    //   }
    // });

    // 6. Upsert into Qdrant
    try {
      const res = await client.upsert(collectionName, {
        points: points,
      });
    } catch (e: unknown) {
      console.log(`Error: $e`);
      throw e;
    }
    console.log("upsert");
  });
});
