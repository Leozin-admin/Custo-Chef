const Sentry = require("@sentry/node");

Sentry.init({
  dsn: "https://48035a061bff886e8e4be92d3700a23e@o4511820849086464.ingest.de.sentry.io/4511820889129040",
  dataCollection: {
    // Para desabilitar envio de dados de usuário e HTTP bodies, descomente as linhas abaixo.
    // userInfo: false,
    // httpBodies: [],
  },
});