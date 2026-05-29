export type SearchDestinationsRequest = {
  imageDataUrl: string;
  query: string;
  limit?: number;
};

export type DestinationCandidate = {
  id: string;
  title: string;
  subtitle?: string;
  confidence: number;
};

export type SearchDestinationsResult = {
  candidates: DestinationCandidate[];
  message: string;
};

export type GeneratePathRequest = {
  imageDataUrl: string;
  destination: string;
};

export type GeneratePathResult = {
  resultImageUrl: string;
  message: string;
};

export type NavigationBackend = {
  searchDestinations(request: SearchDestinationsRequest): Promise<SearchDestinationsResult>;
  generatePath(request: GeneratePathRequest): Promise<GeneratePathResult>;
};
