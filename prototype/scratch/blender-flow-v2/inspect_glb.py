"""Inspect the actual uncompressed GLB, including exported vertex colors."""
import json
from pathlib import Path
import struct
import sys


def inspect(path):
    raw=path.read_bytes()
    magic,version,total=struct.unpack_from('<4sII',raw)
    assert magic==b'glTF' and version==2 and total==len(raw), 'Invalid GLB header'
    length,kind=struct.unpack_from('<II',raw,12)
    assert kind==0x4E4F534A
    document=json.loads(raw[20:20+length])
    offset=20+length
    binary_length,binary_kind=struct.unpack_from('<II',raw,offset)
    assert binary_kind==0x004E4942
    binary=raw[offset+8:offset+8+binary_length]
    node=next(n for n in document['nodes'] if n.get('name')=='Zibloo_Continuous_Skin')
    skin=document['meshes'][node['mesh']]
    ranges=[]
    for primitive in skin['primitives']:
        assert 'COLOR_0' in primitive['attributes'], 'Belly vertex color was lost'
        assert 'KHR_draco_mesh_compression' not in primitive.get('extensions',{})
        accessor=document['accessors'][primitive['attributes']['COLOR_0']]
        view=document['bufferViews'][accessor['bufferView']]
        components={'VEC3':3,'VEC4':4}[accessor['type']]
        code,size={5121:('B',1),5123:('H',2),5126:('f',4)}[accessor['componentType']]
        stride=view.get('byteStride',size*components)
        start=view.get('byteOffset',0)+accessor.get('byteOffset',0)
        colors=[struct.unpack_from('<'+code*components,binary,start+i*stride)[:3]
                for i in range(accessor['count'])]
        unique=len(set(colors))
        assert unique>8, 'No meaningful teal/mint color variation'
        ranges.append({'vertices':accessor['count'],'unique_colors':unique})
    assert not any(n.get('name')=='Studio_Ground' for n in document.get('nodes',[]))
    result={'valid_glb':True,'body_color_0':ranges,'glb_bytes':len(raw),
            'required_extensions':document.get('extensionsRequired',[])}
    path.with_name('glb-inspection.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result,indent=2))


if __name__=='__main__':inspect(Path(sys.argv[1]))
