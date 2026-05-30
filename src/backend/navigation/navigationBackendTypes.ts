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

export type GenerateWallMaskRequest = {
  imageDataUrl: string;
};

export type GenerateWallMaskResult = {
  wallMaskDataUrl: string;
  message: string;
};

export type EndpointPoint = {
  x: number;
  y: number;
  confidence: number;
};

export type LocateEndpointsRequest = {
  imageDataUrl: string;
  destination: string;
};

export type LocateEndpointsResult = {
  start: EndpointPoint;
  end: EndpointPoint;
  message: string;
};

export type NavigationBackend = {
  searchDestinations(
    request: SearchDestinationsRequest,
    options?: { signal?: AbortSignal },
  ): Promise<SearchDestinationsResult>;
  generateWallMask(
    request: GenerateWallMaskRequest,
    options?: { signal?: AbortSignal },
  ): Promise<GenerateWallMaskResult>;
  locateEndpoints(
    request: LocateEndpointsRequest,
    options?: { signal?: AbortSignal },
  ): Promise<LocateEndpointsResult>;
};
