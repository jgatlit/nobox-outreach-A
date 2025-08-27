import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

interface ApiRequestOptions {
  isFormData?: boolean;
}

export async function apiRequest(
  methodOrUrl: string,
  urlOrData?: string | unknown,
  dataOrOptions?: unknown | ApiRequestOptions,
  options?: ApiRequestOptions
): Promise<any> {
  // Handle overloaded method signatures
  let method: string;
  let url: string;
  let data: unknown | undefined;
  let opts: ApiRequestOptions | undefined;
  
  if (urlOrData && typeof urlOrData === 'string') {
    // First overload: (method, url, data?, options?)
    method = methodOrUrl;
    url = urlOrData;
    data = dataOrOptions;
    opts = options;
  } else {
    // Second overload: (url, data?, options?)
    method = 'GET';
    url = methodOrUrl;
    data = urlOrData;
    opts = dataOrOptions as ApiRequestOptions;
  }
  
  const isFormData = opts?.isFormData || data instanceof FormData;
  
  const res = await fetch(url, {
    method,
    headers: data && !isFormData ? { "Content-Type": "application/json" } : {},
    body: data ? (isFormData ? data as FormData : JSON.stringify(data)) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  
  // Try to parse as JSON, but fall back to returning the response if not JSON
  try {
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await res.json();
    }
    return res;
  } catch (error) {
    return res;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
