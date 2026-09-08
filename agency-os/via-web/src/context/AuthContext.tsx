import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { 
AuthUser, 
LoginInput, 
useGetMe, 
getGetMeQueryKey, 
login, 
logout, 
setAuthTokenGetter 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    setAuthTokenGetter(() => localStorage.getItem("accessToken"));
  }, []);

  const { data: me, isLoading: isLoadingMe, isError } = useGetMe({
    query: {
      enabled: !!localStorage.getItem("accessToken"),
      queryKey: getGetMeQueryKey(),
      retry: false,
    }
  });

  useEffect(() => {
    if (me) {
      setUser(me);
    } else if (isError) {
      setUser(null);
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
    }
    
    if (!isLoadingMe) {
      setIsInitializing(false);
    }
  }, [me, isLoadingMe, isError]);

  // Handle case where there is no token initially
  useEffect(() => {
    if (!localStorage.getItem("accessToken")) {
      setIsInitializing(false);
    }
  }, []);

  const loginFn = async (input: LoginInput) => {
    const res = await login(input);
    localStorage.setItem("accessToken", res.tokens.accessToken);
    localStorage.setItem("refreshToken", res.tokens.refreshToken);
    setUser(res.user);
    queryClient.setQueryData(getGetMeQueryKey(), res.user);
  };

  const logoutFn = async () => {
    try {
      const refreshToken = localStorage.getItem("refreshToken");
      if (refreshToken) {
        await logout({ refreshToken });
      }
    } catch (e) {
      console.error("Logout failed", e);
    } finally {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      setUser(null);
      queryClient.clear();
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      isLoading: isInitializing || isLoadingMe,
      login: loginFn,
      logout: logoutFn,
      isAuthenticated: !!user
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
