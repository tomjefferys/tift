import { Obj, ObjValue, ObjArray, stringValue } from "./types"


// Think about how to sructure this
// Could we take inspiration from entity component systems
class Engine {
  private objs : {[key:string]: Obj} = {};
  
  constructor(objs : Obj[]) {
    for(const obj of objs) {
      this.objs[stringValue(obj["name"])] = obj;
    }
  }


}
