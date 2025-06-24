import DodoPayments from "dodopayments";

const isDev = process.env.NODE_ENV === "development";
const isPreview = process.env.NEXT_PUBLIC_ENV === "preview";

export const dodopayments = new DodoPayments({
  bearerToken:
    isDev || isPreview
      ? process.env.DODO_API_KEY_TEST
      : process.env.DODO_API_KEY_LIVE,

  environment: isDev || isPreview ? "test_mode" : "live_mode",
});
