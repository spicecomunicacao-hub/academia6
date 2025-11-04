import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    try {
      // Tentar extrair mensagem de erro JSON primeiro
      const errorData = await res.json();
      console.error('❌ Erro da API:', errorData);
      throw new Error(errorData.message || res.statusText);
    } catch (jsonError) {
      // Se não for JSON válido, usar texto simples
      const text = res.statusText || `Erro ${res.status}`;
      console.error('❌ Erro de rede:', text, 'Response status:', res.status);
      throw new Error(text);
    }
  }
}

// Detectar se está rodando no Netlify e configurar URL base da API
function getApiBaseUrl(): string {
  // Sempre usar URL relativa - funciona tanto no Netlify (com Functions) quanto localmente
  return '';
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const baseUrl = getApiBaseUrl();
  const fullUrl = baseUrl + url;
  
  console.log('🌐 API Request:', { method, url, fullUrl, isNetlify: baseUrl !== '' });
  
  try {
    const res = await fetch(fullUrl, {
      method,
      headers: data ? { "Content-Type": "application/json" } : {},
      body: data ? JSON.stringify(data) : undefined,
      credentials: "omit", // Sempre omitir credentials para evitar problemas de CORS
    });

    console.log('📡 Response received:', { status: res.status, statusText: res.statusText, ok: res.ok });
    
    await throwIfResNotOk(res);
    return res;
  } catch (fetchError) {
    console.error('💥 Fetch error:', fetchError);
    // Se for um erro de rede (como CORS ou conectividade), criar uma mensagem mais clara
    if (fetchError instanceof TypeError && fetchError.message.includes('fetch')) {
      throw new Error('Erro de conexão com o servidor. Verifique sua internet ou tente novamente.');
    }
    throw fetchError;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const baseUrl = getApiBaseUrl();
    const url = baseUrl + queryKey.join("/");
    
    console.log('🔍 Query Request:', { queryKey, url, isNetlify: baseUrl !== '' });
    
    const res = await fetch(url, {
      credentials: "omit", // Sempre omitir credentials para evitar problemas de CORS
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
