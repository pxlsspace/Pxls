package space.pxls.util;

import space.pxls.App;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class TextFilter {
    private static TextFilter _instance;
    public static TextFilter getInstance() {
        if (_instance == null) _instance = new TextFilter();
        return _instance;
    }
    private List<String> staticNeedle = new ArrayList<>();
    private List<Pattern> regexNeedle = new ArrayList<>();

    private TextFilter() {
        reload();
    }

    public void reload() {
        try {
            staticNeedle = App.getConfig().getStringList("textFilter.static");

            regexNeedle.clear();
            for (String s : App.getConfig().getStringList("textFilter.regex")) {
                try {
                    regexNeedle.add(Pattern.compile(s, Pattern.CASE_INSENSITIVE));
                } catch (Exception e) {
                    e.printStackTrace();
                    System.err.println("Failed to parse textFilter regex: " + s);
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
            System.err.println("Failed to reload TextFilter needles");
        }
    }

    public boolean filterHit(String haystack) {
        return filterHit(haystack, false);
    }
    public boolean filterHit(String haystack, boolean reloadHaystack) {
        if (reloadHaystack) {
            reload();
        }
        haystack = haystack.trim();
        if (haystack.length() == 0) return false;
        if (staticNeedle.size() == 0 && regexNeedle.size() == 0) return false;

        for (String s : staticNeedle) {
            if (s.toLowerCase().contains(haystack.toLowerCase())) return true;
        }
        for (Pattern p : regexNeedle) {
            if (p.matcher(haystack).find()) return true;
        }
        return false;
    }

    public FilterResult filter(String haystack) { return filter(haystack, false);}
    public FilterResult filter(String haystack, boolean reloadHaystack) {
        if (reloadHaystack) reload();
        String toReturn = haystack;
        boolean anyHits = false;
        for (String needle : staticNeedle) {
            if (toReturn.toLowerCase().contains(needle.toLowerCase())) {
                //We want to have a case-insensitive search, but we still want to preserve the case of the original string. So, we have to loop with indexOf on lower case, then replace on the original until we're out of occurrances.
                anyHits = true;
                int index = toReturn.toLowerCase().lastIndexOf(needle.toLowerCase());
                while (index > -1) {
                    toReturn = toReturn.substring(0, index) + repeat("\\*", needle.length()) + toReturn.substring(index+needle.length());
                    index = toReturn.toLowerCase().lastIndexOf(needle.toLowerCase(), index+1);
                }
            }
        }
        for (Pattern p : regexNeedle) {
            Matcher m = p.matcher(toReturn);
            if (m.find()) {
                anyHits = true;
                toReturn = m.replaceAll("\\\\*\\\\*\\\\*");
            }
        }

        return new FilterResult(anyHits, haystack, toReturn);
    }

    private String repeat(String repeat, int times) {
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < times; i++) {
            out.append(repeat);
        }
        return out.toString();
    }

    public class FilterResult {
        public final boolean filterHit;
        public final String original;
        public final String filtered;

        public FilterResult(boolean filterHit, String original, String filtered) {
            this.filterHit = filterHit;
            this.original = original;
            this.filtered = filtered;
        }

        @Override
        public String toString() {
            return String.format("[FilterResult] hit: %s. Filtered: %s (original: %s)", filterHit, filtered, original);
        }
    }
}
