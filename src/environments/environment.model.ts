export interface AppEnvironment {
  production: boolean;
  appName: string;
  firebase: {
    apiKey: string;
    authDomain: string;
    databaseURL: string;
    projectId: string;
    messagingSenderId: string;
    appId: string;
    measurementId?: string;
  };
}
