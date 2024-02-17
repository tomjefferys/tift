
export type SearchTerm = Word | WildCard;

export const WILD_CARD : WildCard = {type : "wildCard"};

export type Word = {
  type : "searchWord",
  word : string
}

export type WildCard = {
  type : "wildCard"
}

export const fromStrings = (...words : string[]) : SearchTerm[] =>
  words.map(word => (word === "?")?  WILD_CARD : {type : "searchWord", word});