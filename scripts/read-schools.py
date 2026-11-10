"""Read the existing school workbook without changing it or writing a data copy."""
import json
import re
import sys
import xml.etree.ElementTree as ET
import zipfile

NS = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def read_schools(path):
    with zipfile.ZipFile(path) as workbook:
        strings = []
        if "xl/sharedStrings.xml" in workbook.namelist():
            strings = ["".join(e.itertext()) for e in ET.fromstring(workbook.read("xl/sharedStrings.xml")).findall("s:si", NS)]
        sheet = ET.fromstring(workbook.read("xl/worksheets/sheet1.xml"))
        result = []
        seen = set()
        for row in sheet.findall(".//s:sheetData/s:row", NS):
            values = {}
            for cell in row.findall("s:c", NS):
                entry = cell.find("s:v", NS)
                inline = cell.find("s:is", NS)
                value = entry.text if entry is not None else "".join(inline.itertext()) if inline is not None else ""
                if cell.get("t") == "s":
                    value = strings[int(value)]
                values[re.sub(r"\d+$", "", cell.get("r", ""))] = value
            if values.get("D", "").strip().lower() != "cheyenne":
                continue
            name = " ".join(values["A"].split())
            if name.casefold() in seen:
                continue
            seen.add(name.casefold())
            result.append({"name": name, "rawLevel": values["B"], "address": values["C"], "lat": float(values["E"]), "lon": float(values["F"])})
        return result


if __name__ == "__main__":
    print(json.dumps(read_schools(sys.argv[1]), ensure_ascii=True))
