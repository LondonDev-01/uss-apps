#!bin/bash

files=$(find excels -maxdepth 1 -type f | wc -l)

if ((files == 1)); then
  rm frontend/public/excels/horarios.xlsx
  cp excels/* frontend/public/excels/horarios.xlsx
else
  echo "Error, hay mas de un archivo"
fi
