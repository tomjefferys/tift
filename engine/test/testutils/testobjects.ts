export const GAME_METADATA = {
    "id" : "__metadata__",
    "type" : "metadata",
    "name" : "unittest",
    "author" : "Presto Turnip",
    "options" : ["useDefaultVerbs"]
}; 

export const THE_ROOM = {
    id : "theRoom",
    name : "The Room",
    description : "An almost empty room",
    type : "room",
    tags : [ "start" ]
};

export const ORDINARY_ITEM = {
    id : "anItem",
    name : "an ordinary item",
    type : "item",
    location : "theRoom",
    tags : ["carryable"]
};

export const OTHER_ITEM = {
    id : "otherItem",
    name : "another item",
    type : "item",
    location : "theRoom",
    tags : ["carryable"]
};

export const YET_ANOTHER_ITEM = {
    id : "otherItem2",
    name : "another another item",
    type : "item",
    location : "theRoom",
    tags : ["carryable"]
};

export const NORTH_ROOM = {
    id : "northRoom",
    type : "room",
    tags : [ "start" ]
};

export const SOUTH_ROOM = {
    id : "southRoom",
    type : "room"
}

export const GOBLIN = {
    id : "goblin", 
    name : "Goblin",
    type : "item",
    tags : ["NPC"]
}