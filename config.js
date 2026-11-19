// Public settings for the app. These values are safe to be public (the anon key only allows what
// the database rules allow; our data lives in Azure and is protected by the API).
window.PATENTE_CONFIG = {
  supabaseUrl: "",        // e.g. "https://abcd1234.supabase.co"
  supabaseAnonKey: "",    // the PUBLIC anon / publishable key — never the service_role / secret key
  providers: ["google"]   // add "azure" once Microsoft login is enabled in Supabase
};
