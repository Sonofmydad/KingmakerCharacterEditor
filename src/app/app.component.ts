import { Component } from '@angular/core';
import {Buffer} from 'buffer';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  player: any = {Money: null, PartyXp: null, CrossSceneState: {m_EntityData: null}};
  dialog = window['electron'].remote.dialog;
  fs = window['electron'].remote.require('fs');
  zip = window['zip'];
  filename: string;
  zipfile: any;

  openFile() {
    var options: any = {filters: [{name: 'Kingmaker Save File', extensions: ['zks'] }],
        properties: ['openFile','treatPackageAsDirectory', 'showHiddenFiles'],
        defaultPath: ''};
    if (window['process'].platform == 'win32')
      options.defaultPath = '%LOCALAPPDATA%\\..\\LocalLow\\Owlcat Games\\Pathfinder Kingmaker\\Saved Games\\'
    if (window['process'].platform == 'darwin')
      options.defaultPath = '~/Library/Application Support/unity.Owlcat Games.Pathfinder Kingmaker/Saved Games/';
    this.dialog.showOpenDialog(null,options, this.unzipAndParseFile);
  }

  saveFile() {
    this.zipfile.file('player.json',JSON.stringify(this.serializeReferences(this.player)));
    var data = this.zipfile.generate({base64: false, compression: 'DEFLATE'});
    this.fs.writeFileSync(this.filename,data,'binary');
  }

  serializeReferences(obj, references?) {
    var clone = {};
    if (Array.isArray(obj))
      clone = [];
    if (references == null)
      references = [];
    if (obj.$id != null)
      references.push(obj.$id);
    for(var i in obj) {
      if(obj[i] != null &&  typeof(obj[i])=="object") {
        if (obj[i].$id != null && references.includes(obj[i].$id))
          clone[i] = {$ref: obj[i].$id}
        else {
          clone[i] = this.serializeReferences(obj[i], references);
        }
      } else
        clone[i] = obj[i];
    }
    return clone;
  }

  unzipAndParseFile = (fileNames) => {
    if (fileNames === undefined) return;
    this.filename = fileNames[0];
    var data = this.fs.readFileSync(this.filename, 'binary');
    this.zipfile = new this.zip(data);
    console.log(this.zipfile);
    var playerString = this.zipfile.files['player.json'].asText();
    if (playerString.charCodeAt(0) == 65279)
      playerString = playerString.substring(1);
    this.player = this.resolveReferences(playerString);
  }

  resolveReferences(json) {
    if (typeof json === 'string')
      json = JSON.parse(json);

    var byid = {}, // all objects by id
    refs = []; // references to objects that could not be resolved
    json = (function recurse(obj, prop?, parent?) {
      if (typeof obj !== 'object' || !obj) // a primitive value
        return obj;
      if ("$ref" in obj) { // a reference
        var ref = obj.$ref;
        if (ref in byid)
            return byid[ref];
        // else we have to make it lazy:
        refs.push([parent, prop, ref]);
        return;
      } else if ("$id" in obj) {
        if (obj.$id in byid)
          return obj;
        var id = obj.$id;
        byid[id] = obj;
        if ("$values" in obj) // an array
            obj = obj.$values.map(recurse);
        else // a plain object
            for (var newprop in obj)
                obj[newprop] = recurse(obj[newprop], newprop, obj)
      } else if (Array.isArray(obj)) {
        obj = obj.map(recurse);
      }
      return obj;
    })(json); // run it!

    for (var i=0; i<refs.length; i++) { // resolve previously unknown references
      var ref = refs[i];
      ref[0][ref[1]] = byid[refs[2]];
      // Notice that this throws if you put in a reference at top-level
    }
    return json;
  }
}
