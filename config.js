// Public settings for the app. These values are safe to be public (the anon key only allows what
// the database rules allow; our data lives in Azure and is protected by the API).
window.PATENTE_CONFIG = {
  supabaseUrl: "https://mjhsaruxzzuxiehukriu.supabase.co",
  supabaseAnonKey: "sb_publishable_cewTdp_rTW-Y2gfaoCBpVg_bUw-eSVV",  // PUBLIC publishable key (never the secret key)
  providers: ["google"]   // add "azure" once Microsoft login is enabled in Supabase
};
