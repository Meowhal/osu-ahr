import config from "config";
import Nedb from 'nedb';
import { PlayerRecord, RecorderOption } from "../plugins/Recorder";
const defaultOption = config.get<RecorderOption>("Recorder");

export async function trial() {
  await topPlayersTrial();
}

async function topPlayersTrial(){
  const pdb = new Nedb<PlayerRecord>("data/p.nedb");
  pdb.loadDatabase((err) => {
    if (err) console.error(err);
    else {
      console.log("seaching");
      pdb.find({}).sort({stayTime: -1}).limit(30).exec((err, docs) => {
        for(let d of docs as any[]) {
          d.stayTime = d.stayTime / 1000.0 / 60 / 60 + "hours";
          d.lastVisit = new Date(d.lastVisit);
          console.log(d);
        }
      });
    }
  });
}