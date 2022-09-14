const fs = require('fs');
const hexConverter = require('./hexConverter');
const specials = require('./specials');
const { XMLParser } = require('fast-xml-parser');
const parser = new XMLParser(
  { ignoreAttributes: false, }
);
function parseTextDocument(document) {
  return document;
}

function parseMaskParade(parade) {
  return parade;
}

function parseEffectParade(parade) {
  return parade;
}

function parseProperty(property) {
  const result = {
    tdsb: property.tdsb ? property.tdsb["@_bdata"] : undefined,
  };
  if (property.tdsn) {
    result.tdsn = property.tdsn.string
      ? property.tdsn.string : hexConverter.hexToAsciiString(property.tdsn["@_bdata"]);
  }

  if (property.tdmn) {
    const index = {
      OvG2: 0,
      otst: 0,
      tdgp: 0,
      tdbs: 0,
    };

    property.tdmn.forEach((tdmn) => {
      const tdmnString = hexConverter.hexToAsciiString(tdmn["@_bdata"].replace(/00/gi, ''));

      switch (tdmnString) {
        case 'ADBE Text Properties':
          result[tdmnString] = parseTextDocument(property.tdgp[index.tdgp]);
          index.tdgp += 1;
          break;
        case 'ADBE Mask Parade':
          result[tdmnString] = parseMaskParade(property.tdgp[index.tdgp]);
          index.tdgp += 1;
          break;
        case 'ADBE Effect Parade':
          result[tdmnString] = parseEffectParade(property.tdgp[index.tdgp]);
          index.tdgp += 1;
          break;
        case 'ADBE Group End':
          break;
        case specials.OvG2:
          result[tdmnString] = property.OvG2[index.OvG2];
          index.OvG2 += 1;
          break;
        case specials.otst:
          result[tdmnString] = property.otst[index.otst];
          index.otst += 1;
          break;
        default:
          if (specials.tdgp.includes(tdmnString)) {
            result[tdmnString] = parseProperty(property.tdgp[index.tdgp]);
            index.tdgp += 1;
          } else {
            result[tdmnString] = parseProperty(property.tdbs[index.tdbs]);
            index.tdbs += 1;
          }
          break;
      }
    });
  }

  if (property.tdum) {
    result.tdum = hexConverter.hexToDouble(property.tdum["@_bdata"]);
  }

  if (property.tduM) {
    result.tduM = hexConverter.hexToDouble(property.tduM["@_bdata"]);
  }

  if (property.cdat) {
    result.cdat = property.cdat["@_bdata"]
      .match(/.{1,16}/g)
      .map(x => hexConverter.hexToDouble(x));
  }

  return result;
}

function parseLayer(layer) {
  const result = {
    // parse string
    string: layer.string,
  };

  if (layer.ldta) {
    const ldta = layer.ldta["@_bdata"];
    const strName = layer.string || ""
    result.ldta = {
      layer_id: hexConverter.hexToDecimal(ldta.slice(0, 8)),
      startTimeline: hexConverter.hexTo32Int(ldta.slice(24, 32))
        / hexConverter.hexTo32Int(ldta.slice(32, 40)),
      startFrame: hexConverter.hexTo32Int(ldta.slice(40, 48))
        / hexConverter.hexTo32Int(ldta.slice(48, 56)),
      duration: hexConverter.hexTo32Int(ldta.slice(56, 64))
        / hexConverter.hexTo32Int(ldta.slice(64, 72)),
      reference_id: hexConverter.hexToDecimal(ldta.slice(80, 88)),
      type: hexConverter.hexToDecimal(ldta.slice(122, 124)),
      name: strName || hexConverter.hexToAsciiString(ldta.slice(128, 192).replace(/00/gi, '')),
      asset_type: hexConverter.hexToDecimal(ldta.slice(262, 264)),
      link_layer_id: hexConverter.hexToDecimal(ldta.slice(264, 272)),
    };
    //if layer is text then fetch properties
    if (result.ldta.type == 1) {
      // result.ldta.text=(layer?.tdgp?.tdgp?.btds?.tdbs?.string??"")
      try {
        result.ldta.font = hexConverter.hexToAsciiString(layer?.tdgp?.tdgp[0]?.btds?.btdk["@_bdata"] || "").split("/0 << /0 (þÿ")[1].split(")")[0].replace(/\u0000/gi, "") || ""
      } catch (err) {
        console.log(err.message)
        result.ldta.font = ""
      }

    }
  }
  // 
  /*
  if (layer.tdgp) {
    result.tdgp = parseProperty(layer.tdgp);
  }
  */

  return result;
}

function parseItem(item) {
  const result = {
    // parse string
    string: item.string,
  };

  // parse idta
  if (item.idta) {
    const idta = item.idta["@_bdata"];
    result.idta = {
      entry_type: hexConverter.hexToDecimal(idta.slice(0, 4)),
      id: hexConverter.hexToDecimal(idta.slice(32, 40)),
      asset_type: hexConverter.hexToDecimal(idta.slice(116, 118)),
    };
  }

  // parse PRin
  if (item.PRin) {
    const prin = item.PRin;

    result.prin = {
      prin: [
        hexConverter.hexToDecimal(prin.prin["@_bdata"].slice(0, 8)),
        hexConverter.hexToAsciiString(prin.prin["@_bdata"].slice(8, 104).replace(/00/gi, '')),
        hexConverter.hexToAsciiString(prin.prin["@_bdata"].slice(104, 200).replace(/00/gi, '')),
        hexConverter.hexToDecimal(prin.prin["@_bdata"].slice(200, 208)),
      ],
      prda: [
        hexConverter.hexToDecimal(prin.prda["@_bdata"].slice(0, 8)),
        hexConverter.hexToDecimal(prin.prda["@_bdata"].slice(8, 16)),
        hexConverter.hexToDecimal(prin.prda["@_bdata"].slice(16, 24)),
      ],
    };
  }

  // parse cdta
  if (item.cdta) {
    const cdta = item.cdta["@_bdata"];

    const frameRatio = hexConverter.hexToDecimal(cdta.slice(8, 16));
    result.cdta = {
      frameRatio,
      currentFrame: hexConverter.hexTo32Int(cdta.slice(40, 48)) / frameRatio,
      duration: hexConverter.hexToDecimal(cdta.slice(88, 96)) / frameRatio,
      backgroundColor: cdta.slice(104, 110),
      width: hexConverter.hexToDecimal(cdta.slice(280, 284)),
      height: hexConverter.hexToDecimal(cdta.slice(284, 288)),
      frameRate: hexConverter.hexToDecimal(cdta.slice(312, 320)) / (2 ** 16),
      startFrame: hexConverter.hexTo32Int(cdta.slice(328, 336))
        / hexConverter.hexTo32Int(cdta.slice(336, 344)),
    };
  }

  // parse Pin
  if (item.Pin) {
    const pin = item.Pin;
    result.pin = {};

    // parse sspc
    if (pin.sspc) {
      const sspc = pin.sspc["@_bdata"];

      result.pin.sspc = {
        file_type: hexConverter.hexToAsciiString(sspc.slice(44, 52)),
        width: hexConverter.hexToDecimal(sspc.slice(60, 68)),
        height: hexConverter.hexToDecimal(sspc.slice(68, 76)),
        duration: hexConverter.hexToDecimal(sspc.slice(76, 84))
          / hexConverter.hexToDecimal(sspc.slice(84, 92)),
        frameRate: hexConverter.hexToDecimal(sspc.slice(116, 124)) / (2 ** 16),
        audioQuality: hexConverter.hexToDouble(sspc.slice(320, 336)),
      };
    }

    // parse fileReference
    if (pin.Als2) {
      const fileReference = pin.Als2.fileReference["@_fullpath"];

      result.filename = fileReference.replace(/^.*[\\/]/, '');
      result.file_reference = fileReference;
    }

    // parse opti
    if (pin.opti) {
      const opti = pin.opti["@_bdata"];
      const optiType = hexConverter.hexToDecimal(opti.slice(8, 12));
      if (optiType === 1) {
        result.pin.opti = {
          file_type: hexConverter.hexToAsciiString(opti.slice(0, 8)),
          type: hexConverter.hexToDecimal(opti.slice(8, 12)),
          byte_length: hexConverter.hexToDecimal(opti.slice(12, 20)),
          width: hexConverter.hexToDecimal(opti.slice(36, 44)),
          height: hexConverter.hexToDecimal(opti.slice(44, 52)),
          name: hexConverter.hexToAsciiString(opti.substr(116).replace(/00/gi, '')),
        };
      }
      if (optiType === 5) {
        result.pin.opti = {
          file_type: hexConverter.hexToAsciiString(opti.slice(0, 8)),
          type: hexConverter.hexToDecimal(opti.slice(8, 12)),
          byte_length: hexConverter.hexToDecimal(opti.slice(12, 20)),
          name: hexConverter.hexToAsciiString(opti.slice(60, 68)),
          codec: hexConverter.hexToAsciiString(opti.slice(76, 84)),
        };
      }
      if (optiType === 9) {
        result.pin.opti = {
          file_type: hexConverter.hexToAsciiString(opti.slice(0, 8)),
          type: hexConverter.hexToDecimal(opti.slice(8, 12)),
          byte_length: hexConverter.hexToDecimal(opti.slice(12, 20)),
          argb: `(${hexConverter.hexToFloat(opti.slice(20, 28))}, ${hexConverter.hexToFloat(opti.slice(28, 36))}, ${hexConverter.hexToFloat(opti.slice(36, 44))}, ${hexConverter.hexToFloat(opti.slice(44, 52))})`,
          name: hexConverter.hexToAsciiString(opti.substr(52).replace(/00/gi, '')),
        };
      }
    }
  }

  // parse Sfdr
  if (item.Sfdr) {
    result.sfdr = parseFold(item.Sfdr); // eslint-disable-line no-use-before-define
  }
  // parse layr
  if (item.Layr) {
    result.layr = Array.isArray(item.Layr) ? item.Layr.map(layr => parseLayer(layr)) : [parseLayer(item.Layr)]
  }
  // parse SLay
  if (item.SLay) {
    result.slay = Array.isArray(item.SLay) ? item.SLay.map(slay => parseLayer(slay)) : [parseLayer(item.SLay)];
  }
  // parse CLay
  if (item.CLay) {
    result.clay = Array.isArray(item.CLay) ? item.CLay.map(clay => parseLayer(clay)) : [parseLayer(item.CLay)];
  }
  // parse SecL
  if (item.SecL) {
    result.secl = Array.isArray(item.SecL) ? item.SecL.map(secl => parseLayer(secl)) : [parseLayer(item.SecL)];
  }

  return result;
}

function parseFold(fold) {
  return {
    items: fold.Item ? (Array.isArray(fold.Item) ? fold.Item.map(item => parseItem(item)) : [parseItem(fold.Item)]) : [],
  };
}

function parseProject(project) {
  return {
    // parse folds
    fold: project.Fold ? parseFold(project.Fold) : undefined,
  };
}

module.exports = {
  parse(data, handler) {
    switch (arguments.length) {
      case 1:
        return new Promise((resolve, reject) => {
          try {
            const target = parser.parse(data)
            return resolve(parseProject(target.AfterEffectsProject));
          } catch (err) {
            reject(err)
          }
        });
      case 2: // callback api
      default:
        try {
          const target = parser.parse(data)
          handler(null, parseProject(target.AfterEffectsProject));
        } catch (err) {
          handler(err, null);
        }
    }
  },
  parseSync(data) {
    const target = parser.parse(data)
    return parseProject(target.AfterEffectsProject);
  },
  parseFile(filePath, handler) {
    switch (arguments.length) {
      case 1:
        return new Promise((resolve, reject) => {
          fs.readFile(filePath, (err, data) => {
            if (err) {
              reject(err);
            }
            try {
              const target = parser.parse(data)
              resolve(parseProject(target.AfterEffectsProject));
            } catch (err) {
              reject(err);
            }
          });
        });
      case 2: // callback api
      default:
        fs.readFile(filePath, (err, data) => {
          if (err) {
            handler(err, null);
          }
          try {
            const target = parser.parse(data)
            handler(null, parseProject(target.AfterEffectsProject));
          } catch (err) {
            handler(err, null);
          }
        });
        return null;
    }
  },
  parseFileSync(filePath) {
    const data = fs.readFileSync(filePath);

    const target = parser.parse(data);
    return parseProject(target.AfterEffectsProject);
  },
};
