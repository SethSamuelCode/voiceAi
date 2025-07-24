  export enum OwnerEnum {
    user = "user",
    ai = "ai",
  }

  export interface ChatObject {
    owner: OwnerEnum;
    message: string;
  }