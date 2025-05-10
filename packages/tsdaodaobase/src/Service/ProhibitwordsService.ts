import WKApp from "../App";
import StorageService from "./StorageService";
import SensitiveWordTool from "sensitive-word-tool";

export class ProhibitwordsService {
  private sensitiveWordTool = new SensitiveWordTool({});

  private constructor() {}
  public static shared = new ProhibitwordsService();

  public prohibitwords: Array<any> = [];

  // 同步敏感词
  async sync() {
    this.load();
    this.refresh();
    let lastVersion = 0;
    if (this.prohibitwords.length > 0) {
      lastVersion = this.prohibitwords[this.prohibitwords.length - 1].version;
    }
    const results = await WKApp.apiClient.get("message/prohibit_words/sync", {
      param: {
        version: lastVersion,
      },
    });
    if (results && results.length > 0) {
      for (const result of results) {
        if (result.version > lastVersion) {
          this.prohibitwords.push(result);
        }
      }
      this.save();
      this.refresh();
    }
  }
  // 从存储加载敏感词
  load() {
    const prohibitwordsJson = StorageService.shared.getItem("prohibitwords");
    if (prohibitwordsJson && prohibitwordsJson.length > 0) {
      this.prohibitwords = JSON.parse(prohibitwordsJson);
    }
  }
  save() {
    StorageService.shared.setItem(
      "prohibitwords",
      JSON.stringify(this.prohibitwords)
    );
  }
  refresh() {
    const words = this.prohibitwords.map((item) => {
      return item.content;
    });
    this.sensitiveWordTool.addWords(words);
  }
  filter(v: string) {
    return this.sensitiveWordTool.filter(v);
  }
}
