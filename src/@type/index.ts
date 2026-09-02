import { Client, Collection, ClientOptions } from "discord.js";

export type { Command } from "./index.d";

export class ExtendedClient extends Client {
  public commands: Collection<string, any>;
  public prefix: string;

  constructor(options?: ClientOptions & { prefix?: string }) {
    super(options as ClientOptions);
    this.commands = new Collection();
    this.prefix = options?.prefix ?? "n";
  }
}

export default ExtendedClient;
