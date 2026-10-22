# Muda versionCode e versionName dentro do AndroidManifest.xml binário (AXML), no lugar.
import struct, sys
src, dst, new_code, new_name = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4]
b = bytearray(open(src, 'rb').read())
assert struct.unpack_from('<H', b, 0)[0] == 0x0003
pos = 8; strings_off = None; resmap = []
while pos < len(b):
    ctype, hsize, csize = struct.unpack_from('<HHI', b, pos)
    if ctype == 0x0001:  # string pool
        count, scount, flags, sstart, _ = struct.unpack_from('<IIIII', b, pos + 8)
        utf8 = bool(flags & 0x100)
        offs = struct.unpack_from('<%dI' % count, b, pos + hsize)
        pool = (pos, sstart, offs, utf8)
    elif ctype == 0x0180:
        resmap = list(struct.unpack_from('<%dI' % ((csize - hsize) // 4), b, pos + hsize))
    elif ctype == 0x0102:
        ext = pos + hsize
        astart, asize, acount = struct.unpack_from('<HHH', b, ext + 8)
        for i in range(acount):
            a = ext + astart + i * asize
            ns, name, raw, vsize, _, dtype, data = struct.unpack_from('<IIIHBBI', b, a)
            rid = resmap[name] if name < len(resmap) else None
            if rid == 0x0101021b:  # versionCode
                print('versionCode', data, '->', new_code); struct.pack_into('<I', b, a + 16, new_code)
            if rid == 0x0101021c:  # versionName
                pstart, sstart, offs, utf8 = pool
                so = pstart + sstart + offs[data]
                if utf8:
                    n = b[so + 1]; old = b[so + 2:so + 2 + n].decode(); enc = new_name.encode()
                    assert len(enc) == n; b[so + 2:so + 2 + n] = enc
                else:
                    n = struct.unpack_from('<H', b, so)[0]; old = b[so + 2:so + 2 + 2 * n].decode('utf-16le'); enc = new_name.encode('utf-16le')
                    assert len(enc) == 2 * n; b[so + 2:so + 2 + 2 * n] = enc
                print('versionName', old, '->', new_name)
    pos += csize
open(dst, 'wb').write(b)
