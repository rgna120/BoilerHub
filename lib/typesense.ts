import TypesenseInstantSearchAdapter from "typesense-instantsearch-adapter";

export const typesenseAdapter = new TypesenseInstantSearchAdapter({
  server: {
    apiKey: process.env.TYPESENSE_SEARCH_ONLY_API_KEY || "xyz",
    nodes: [
      {
        host: process.env.TYPESENSE_HOST || "localhost",
        port: parseInt(process.env.TYPESENSE_PORT || "8108"),
        protocol: process.env.TYPESENSE_PROTOCOL || "http",
      },
    ],
  },
  additionalSearchParameters: {
    query_by: "title,description,category",
  },
});

export const searchClient = typesenseAdapter.searchClient;

export const campusDataSchema = {
  name: "CampusData",
  fields: [
    { name: "id", type: "string" },
    { name: "title", type: "string" },
    { name: "category", type: "string", facet: true },
    { name: "description", type: "string" },
  ],
};
