import { DenseVector, SparseVector } from "./types";

export abstract class Vectorizer {
  abstract toDense(chunks: string): DenseVector;

  abstract toSparse(chunk: string): SparseVector;
}
