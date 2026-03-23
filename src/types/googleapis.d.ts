declare module "googleapis" {
  export const google: {
    auth: {
      OAuth2: new (clientId: string, clientSecret: string, redirectUri: string) => {
        setCredentials: (tokens: any) => void;
        generateAuthUrl: (options: any) => string;
        getToken: (code: string) => Promise<{ tokens: any }>;
        on: (event: string, callback: (tokens: any) => void) => void;
      };
    };
    calendar: (options: { version: string; auth: any }) => {
      events: {
        insert: (options: any) => Promise<{ data: any }>;
        patch: (options: any) => Promise<{ data: any }>;
        delete: (options: any) => Promise<void>;
      };
    };
  };
}
