import _ from "lodash";
import got from "got";
import queryString from "query-string";

// import pkg from "../package.json" with { type: "json" };
const pkg = createRequire(import.meta.url)("../package.json");
import { OaiPmhError } from "./errors.js";
import { getOaiListItems } from "./oai-pmh-list.js";
import { parseOaiPmhXml } from "./oai-pmh-xml.js";
import { createRequire } from "node:module";

// main class
export class OaiPmh {
  constructor(baseUrl, _options = {}) {
    this.baseUrl = baseUrl;

    // default options
    this.options = {
      userAgent: `oai-pmh/${pkg.version} (${pkg.homepage})`,
      retry: true, // automatically retry in case of status code 503
      retryMax: 600000, // wait at maximum 600 seconds, given in milliseconds
    };

    // set user-provided options
    _.assign(this.options, _options);
  }

  // OAI-PMH request with retries for status code 503
  async request({ url, qs, headers }) {
    try {
      const res = await got.get(url, {
        searchParams: queryString.stringify(qs),
        headers: {
          ...(headers || {}),
          "User-Agent": this.options.userAgent,
        },
        retry: this.options.retry
          ? { maxRetryAfter: this.options.retryMax }
          : 0,
      });

      this.lastXMLResponse = res.body;

      return res;
    } catch (error) {
      throw new OaiPmhError(
        `Unexpected status code ${error.response.statusCode} (expected 200).`,
      );
    }
  }

  async getRecord(identifier, metadataPrefix) {
    // send request
    const res = await this.request({
      url: this.baseUrl,
      qs: {
        verb: "GetRecord",
        identifier,
        metadataPrefix,
      },
    });

    // parse xml
    const obj = await parseOaiPmhXml(res.body);

    // parse object
    return _.get(obj, "GetRecord.record");
  }

  async identify() {
    // send request
    const res = await this.request({
      url: this.baseUrl,
      qs: {
        verb: "Identify",
      },
    });

    // parse xml
    const obj = await parseOaiPmhXml(res.body);

    // parse object
    return obj.Identify;
  }

  listIdentifiers(options) {
    return getOaiListItems(this, "ListIdentifiers", "header", options);
  }

  async listMetadataFormats(options = {}) {
    // send request
    const res = await this.request({
      url: this.baseUrl,
      qs: {
        verb: "ListMetadataFormats",
        identifier: options.identifier,
      },
    });

    // parse xml
    const obj = await parseOaiPmhXml(res.body);

    // parse object
    return _.get(obj, "ListMetadataFormats.metadataFormat");
  }

  listRecords(options) {
    return getOaiListItems(this, "ListRecords", "record", options);
  }

  listSets() {
    return getOaiListItems(this, "ListSets", "set");
  }
}
