export interface AppEnvironment {
  production: boolean;
  appName: string;
  firebase: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
    measurementId?: string;
  };
  /** Allows an offline, browser-only demo workspace backed by localStorage. */
  enableDemoMode: boolean;
}
