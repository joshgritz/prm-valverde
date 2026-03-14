#!/usr/bin/env python3
"""
EXTRACTOR DE PADRÓN PRM - VALVERDE
===================================
Procesa PDFs del padrón y genera:
  1. Un archivo JSON con todos los militantes + fotos en base64
  2. Un archivo SQL para importar directamente a Supabase

USO:
  python extractor_padron.py ruta/al/padron.pdf
  python extractor_padron.py carpeta/con/pdfs/   (procesa todos)

REQUISITOS:
  pip install pdfplumber pypdf pillow

SALIDA:
  padron_COLEGIO.json  - datos completos con fotos
  padron_COLEGIO.sql   - INSERT para Supabase
"""

import sys, os, json, base64, re
from pathlib import Path

try:
    import pdfplumber
    from pypdf import PdfReader
except ImportError:
    print("ERROR: Instala las dependencias:")
    print("  pip install pdfplumber pypdf pillow")
    sys.exit(1)


def extract_padron_pdf(pdf_path: str) -> dict:
    """Extrae todos los militantes de un PDF de padrón PRM."""
    
    reader = PdfReader(pdf_path)
    total_pages = len(reader.pages)
    all_persons = []
    colegio_info = {}

    # --- Extraer info del colegio de la primera página ---
    with pdfplumber.open(pdf_path) as pdf:
        page0 = pdf.pages[0]
        words0 = page0.extract_words()
        
        # Número de colegio y electores
        for w in words0:
            if w['top'] < 55:
                if w['text'].isdigit() and len(w['text']) == 4 and w['x0'] > 480:
                    colegio_info['colegio'] = w['text']
                if w['text'].isdigit() and len(w['text']) == 3 and w['x0'] > 440 and w['x0'] < 480:
                    colegio_info['electores'] = w['text']
        
        # Nombre del recinto
        rec_words = [w for w in words0 if 72 < w['top'] < 95 and w['x0'] > 200]
        colegio_info['recinto'] = ' '.join(w['text'] for w in rec_words)
        
        # Municipio y provincia
        mun_words = [w for w in words0 if 42 < w['top'] < 52 and w['x0'] > 290]
        colegio_info['municipio'] = ' '.join(w['text'] for w in mun_words)

    colegio_num = colegio_info.get('colegio', 'XXXX')
    print(f"  📋 Colegio: {colegio_num} | {colegio_info.get('recinto','')[:50]}")

    cedula_pattern = re.compile(r'^\d{3}-\d{7}-\d$')

    # --- Procesar cada página ---
    for page_num in range(total_pages):
        page_pypdf = reader.pages[page_num]
        
        # Extraer imágenes JPEG de la página
        images_b64 = {}
        try:
            xobjects = page_pypdf['/Resources']['/XObject']
            for name, obj in xobjects.items():
                try:
                    if obj.get('/Filter') == '/DCTDecode':
                        data = obj.get_data()
                        images_b64[name.lstrip('/')] = base64.b64encode(data).decode()
                except Exception:
                    pass
        except Exception:
            pass

        with pdfplumber.open(pdf_path) as pdf:
            page = pdf.pages[page_num]
            images_pos = page.images
            words = page.extract_words()

            # Mapa de imágenes por posición (columna + top aproximado)
            img_by_pos = {}
            for img in images_pos:
                if 60 < img['width'] < 120 and 60 < img['height'] < 120:
                    col = 'L' if img['x0'] < 200 else 'R'
                    key = (col, round(img['top'] / 10) * 10)
                    img_by_pos[key] = img['name']

            # Encontrar todas las cédulas
            cedula_words = [w for w in words if cedula_pattern.match(w['text'])]

            for cw in cedula_words:
                cedula = cw['text']
                row_top = cw['top']
                is_left = cw['x0'] < 300
                x_min = 0 if is_left else 290
                x_max = 290 if is_left else 620
                col = 'L' if is_left else 'R'

                # Palabras en el área de esta persona
                row_words = [w for w in words
                             if row_top - 3 <= w['top'] <= row_top + 75
                             and x_min <= w['x0'] <= x_max]

                # Número de posición
                num_words = [w for w in row_words
                             if w['text'].isdigit() and w['top'] == row_top
                             and w['x0'] > (x_min + 100)]
                numero = num_words[0]['text'] if num_words else ''

                # Nombre completo
                name_words = [w for w in row_words
                              if abs(w['top'] - (row_top + 14)) < 7
                              and w['text'] not in ['Votó:', 'EXT', 'PA', 'PC', 'PRM:', 'PLD:']
                              and not cedula_pattern.match(w['text'])
                              and not w['text'].isdigit()]
                nombre = ' '.join(w['text'] for w in name_words).strip()

                # Teléfono(s)
                telefonos = []
                area_pattern = re.compile(r'\(8[024]\d\)')
                for i, w in enumerate(row_words):
                    if area_pattern.match(w['text']):
                        area = w['text'][1:4]
                        next_w = [x for x in row_words
                                  if x['x0'] > w['x0'] + 3 and abs(x['top'] - w['top']) < 4]
                        if next_w:
                            telefonos.append(f"{area}-{next_w[0]['text']}")
                telefono = telefonos[0] if telefonos else ''
                telefono2 = telefonos[1] if len(telefonos) > 1 else ''

                # Dirección
                dir_words = [w for w in row_words if w['text'] == 'Dir:']
                direccion = ''
                if dir_words:
                    dir_top = dir_words[0]['top']
                    dir_x = dir_words[0]['x0']
                    d_parts = [w['text'] for w in row_words
                               if abs(w['top'] - dir_top) < 5 and w['x0'] > dir_x + 10
                               and w['text'] not in ['PRM:', 'PLD:', 'Conc:']]
                    direccion = ' '.join(d_parts)

                # Voto y exterior
                voto = next((w['text'] for w in row_words if w['text'] in ['PA', 'PC']), '')
                exterior = any(w['text'] == 'EXT' for w in row_words)
                concurrencia = [w['text'] for w in row_words if w['text'] in ['2016', '2010']]

                # Foto (buscar imagen en posición correcta)
                img_key = (col, round((row_top - 3) / 10) * 10)
                photo_name = img_by_pos.get(img_key)
                if not photo_name:
                    for (c, t), n in img_by_pos.items():
                        if c == col and abs(t - round(row_top / 10) * 10) <= 3:
                            photo_name = n
                            break
                foto_b64 = images_b64.get(photo_name, '') if photo_name else ''

                all_persons.append({
                    'cedula': cedula,
                    'nombre': nombre,
                    'numero': numero,
                    'telefono': telefono,
                    'telefono2': telefono2,
                    'direccion': direccion,
                    'voto': voto,
                    'exterior': exterior,
                    'concurrencia': concurrencia,
                    'foto_b64': foto_b64,
                    'colegio': colegio_num,
                    'recinto': colegio_info.get('recinto', ''),
                    'municipio': colegio_info.get('municipio', 'MAO'),
                })

    con_foto = sum(1 for p in all_persons if p['foto_b64'])
    print(f"  ✅ {len(all_persons)} militantes extraídos | {con_foto} con foto")
    
    return {
        'colegio_info': colegio_info,
        'total': len(all_persons),
        'con_foto': con_foto,
        'militantes': all_persons
    }


def generar_sql(result: dict, output_path: str):
    """Genera archivo SQL para importar a Supabase."""
    militantes = result['militantes']
    
    lines = [
        "-- PADRÓN PRM VALVERDE - Generado por extractor_padron.py",
        f"-- Colegio: {result['colegio_info'].get('colegio','?')} | {result['colegio_info'].get('recinto','')}",
        f"-- Total: {result['total']} militantes",
        "",
        "INSERT INTO padron_maestro",
        "  (cedula, nombre_completo, telefono, telefono2, direccion,",
        "   voto_primaria, empadronado_exterior, concurrencia_2016,",
        "   concurrencia_2010, colegio_num, recinto_nombre, foto_base64)",
        "VALUES"
    ]
    
    rows = []
    for m in militantes:
        cedula = m['cedula'].replace("'", "''")
        nombre = m['nombre'].replace("'", "''")
        tel = m['telefono'].replace("'", "''")
        tel2 = m['telefono2'].replace("'", "''")
        dir_ = m['direccion'].replace("'", "''")
        voto = m['voto']
        ext = 'TRUE' if m['exterior'] else 'FALSE'
        conc16 = 'TRUE' if '2016' in m['concurrencia'] else 'FALSE'
        conc10 = 'TRUE' if '2010' in m['concurrencia'] else 'FALSE'
        colegio = m['colegio']
        recinto = m['recinto'].replace("'", "''")[:100]
        foto = m['foto_b64'][:500] if m['foto_b64'] else ''  # truncate for SQL preview
        
        rows.append(
            f"  ('{cedula}', '{nombre}', '{tel}', '{tel2}', '{dir_}',\n"
            f"   '{voto}', {ext}, {conc16}, {conc10},\n"
            f"   '{colegio}', '{recinto}', '{foto[:50]}...')"
        )
    
    lines.append(',\n'.join(rows))
    lines.append("ON CONFLICT (cedula) DO UPDATE SET")
    lines.append("  nombre_completo = EXCLUDED.nombre_completo,")
    lines.append("  telefono = EXCLUDED.telefono,")
    lines.append("  colegio_num = EXCLUDED.colegio_num;")
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    
    print(f"  💾 SQL generado: {output_path}")


def procesar_pdf(pdf_path: str):
    """Procesa un PDF y genera JSON + SQL."""
    print(f"\n📄 Procesando: {Path(pdf_path).name}")
    
    result = extract_padron_pdf(pdf_path)
    
    base_name = Path(pdf_path).stem
    out_dir = Path(pdf_path).parent
    
    # Guardar JSON
    json_path = out_dir / f"padron_{base_name}.json"
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print(f"  💾 JSON: {json_path} ({json_path.stat().st_size // 1024} KB)")
    
    # Guardar SQL (sin fotos, para importar datos)
    sql_path = out_dir / f"padron_{base_name}.sql"
    generar_sql(result, str(sql_path))
    
    return result


def main():
    if len(sys.argv) < 2:
        print("USO: python extractor_padron.py archivo.pdf")
        print("     python extractor_padron.py carpeta/")
        sys.exit(1)
    
    target = Path(sys.argv[1])
    
    if target.is_file():
        procesar_pdf(str(target))
    elif target.is_dir():
        pdfs = list(target.glob("*.pdf")) + list(target.glob("*.PDF"))
        print(f"🗂️  Encontrados {len(pdfs)} PDFs en {target}")
        for pdf in sorted(pdfs):
            procesar_pdf(str(pdf))
    else:
        print(f"ERROR: No se encontró: {target}")
        sys.exit(1)
    
    print("\n✅ ¡Listo! Revisa los archivos .json y .sql generados.")


if __name__ == '__main__':
    main()
