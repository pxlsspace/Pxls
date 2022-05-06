#!/usr/bin/bash
for localization in  po/*.po
do
    msgmerge -N -U --no-wrap $localization po/Localization.pot
done
