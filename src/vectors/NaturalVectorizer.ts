import { Vectorizer } from "./Vectorizer";
import { DenseVector, SparseVector } from "./types";
import { TfIdf } from "natural";

export class NaturalVectorizer extends Vectorizer {
  override toDense(chunk: string): DenseVector {
    throw new Error("Method not implemented.");
  }
  override toSparse(chunk: string): SparseVector {
    const tfidf = new TfIdf();

    // 3. Build the corpus
    tfidf.addDocument(chunk);

    // 4. Extract sparse vectors
    // const { indices, values } = chunks.map((_, docIndex) => {
    const terms = tfidf.listTerms(0);
    return {
      indices: terms.map((t) => t.term),
      values: terms.map((t) => t.tfidf),
    };
    // })[0];
    //
    // return {
    //   indices: indices,
    //   values: values,
    // };
  }
}
