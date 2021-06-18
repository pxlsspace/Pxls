module.exports.TH = (function() { // place typeahead in its own pseudo namespace
  /**
   *
   * @param {string} char The char trigger. Should only be a one byte wide grapheme. Emojis will fail
   * @param {string} dbType The type of the database, acts internally as a map key.
   * @param {boolean} [hasPair=false] Whether or not this trigger has a matching pair at the end, e.g. ':word:' vs '@word'
   * @param {number} [minLength=0] The minimum length of the match before this trigger is considered valid.
   *                                Length is calculated without `this.char`, so a trigger of ":" and a match of ":one" will be a length of 3.
   * @constructor
   */
  function Trigger(char, dbType, hasPair = false, minLength = 0) {
    this.char = char;
    this.dbType = dbType;
    this.hasPair = hasPair;
    this.minLength = minLength;
  }

  /**
   *
   * @param {number} start The first (typically left-most) index of the trigger match
   * @param {number} end The right (typically right-most) index of the trigger match
   * @param {Trigger} trigger The trigger this match is for
   * @param {string} word The whole word this trigger matches
   * @constructor
   */
  function TriggerMatch(start, end, trigger, word) {
    this.start = start;
    this.end = end;
    this.trigger = trigger;
    this.word = word;
  }

  /**
   *
   * @typedef TypeaheadEntry
   * @type {object}
   * @property {string} key The key of the entry, to be matched by the typeahead.
   * @property {string} value The value of the entry, what the typeahead should output when the option is selected.
   */

  /**
   *
   * @callback TypeaheadInserterCallback
   * @param {TypeaheadEntry} entry
   */
  /**
   *
   * @callback TypeaheadRendererCallback
   * @param {TypeaheadEntry} entry
   */

  const defaultCallback = (entry) => entry.value;

  /**
   *
   * @param {string} name The name of the database. Used internally as an accessor key.
   * @param {object} [initData={}] The initial data to seed this database with.
   * @param {boolean} [caseSensitive=false] Whether or not searches are case sensitive.
   * @param {boolean} [leftAnchored=false] Whether or not searches are left-anchored.
   *                                       If true, `startsWith` is used. Otherwise, `includes` is used.
   * @param {TypeaheadInserterCallback} [inserter] Function ran to insert an entry into the text field.
   * @param {TypeaheadRendererCallback} [renderer] Function ran to render an entry on the typeahead prompt.
   * @constructor
   */
  function Database(name, initData = {}, caseSensitive = false, leftAnchored = false, inserter = defaultCallback, renderer = defaultCallback) {
    this.name = name;
    this._caseSensitive = caseSensitive;
    this.initData = initData;
    this.leftAnchored = leftAnchored;
    this.inserter = inserter;
    this.renderer = renderer;

    const fixKey = key => this._caseSensitive ? key.trim() : key.toLowerCase().trim();
    this.search = (start) => {
      start = fixKey(start);
      return Object.entries(this.initData)
        .filter(x => {
          const key = fixKey(x[0]);
          return this.leftAnchored ? key.startsWith(start) : key.includes(start);
        })
        .map(x => ({
          key: x[0],
          value: x[1]
        }));
    };
    this.addEntry = (key, value) => {
      key = key.trim();
      this.initData[key] = value;
    };
    this.removeEntry = (key, value) => {
      key = key.trim();
      delete this.initData[key];
    };
  }

  /**
   *
   * @param {Trigger[]} triggers
   * @param {string[]} [stops=[' ']] An array of characters that mark the bounds of a match, e.g. if we have an input of "one two", a cancels of [' '], and we search from the end of the string, we'll grab the word "two"
   * @param {Database[]} [DBs=[]] The databases to scan for trigger matches
   * @constructor
   */
  function Typeahead(triggers, stops = [' '], DBs = []) {
    this.triggers = {};
    this.triggersCache = [];
    this.stops = stops;
    this.DBs = DBs;
    if (!Array.isArray(triggers) && triggers instanceof Trigger) {
      triggers = [triggers];
    }

    triggers.forEach(trigger => {
      this.triggers[trigger.char] = trigger;
      if (!this.triggersCache.includes(trigger.char)) this.triggersCache.push(trigger.char);
    });

    /**
     * Scans the given string from the specified start position for a trigger match.
     * Starts from the right and scans left for a trigger. If found, we then scan to the right of the start index for a word break.
     *
     * @param {number} startIndex The index to start searching from. Typically {@link HTMLInputElement#selectionStart}
     * @param {string} searchString The string to search through. Typically {@link HTMLInputElement#value}
     * @returns {TriggerMatch|boolean} `false` if failed, a `TriggerMatch` otherwise.
     */
    this.scan = (startIndex, searchString) => {
      const match = new TriggerMatch(0, searchString.length, null, '');
      let matched = false;
      let foundOnce = false;
      for (let i = startIndex - 1; i >= 0; i--) { // Search left from the starting index looking for a trigger match
        const char = searchString.charAt(i);
        if (this.triggersCache.includes(char)) {
          match.start = i;
          match.trigger = this.triggers[char];
          matched = true;
          if (foundOnce) break; else foundOnce = true; // We only break if we've foundOnce so that if we start at the end of something like ":word:" we don't short circuit at the first one we see.
          // We don't just go until we see a break character because ":d:word:" is not a valid trigger. Can expand trigger in the future to potentially catch this though if a usecase pops up.
        } else if (this.stops.includes(char)) {
          break;
        }
      }
      if (matched) {
        for (let i = startIndex; i < searchString.length; i++) {
          const char = searchString.charAt(i);
          if (this.stops.includes(char)) { // we found the end of our word
            match.end = i;
            break;
          }
        }

        // If we have a pair and it's present, we don't want to include it in our DB searches. We go to len-1 in order to grab the whole word only (it's the difference between "word:" and "word")
        const fixedEnd = (match.trigger.hasPair && searchString.charAt(match.end - 1) === match.trigger.char) ? match.end - 1 : match.end;
        match.word = searchString.substring(match.start + 1, fixedEnd);
      }

      return matched ? (match.word.length >= match.trigger.minLength ? match : false) : false;
    };

    /**
     * @param {TriggerMatch} trigger The trigger match we should look for suggestions on.
     */
    this.suggestions = (trigger) => {
      let db = this.DBs.filter(x => x.name === trigger.trigger.dbType);
      if (!db || !db.length) return [];
      db = db[0];
      return db.search(trigger.word, trigger.trigger.leftAnchored);
    };

    /**
     * Gets the requested database.
     *
     * @param {string} dbName The database's name.
     * @see {@link Database#name}
     * @returns {null|Database}
     */
    this.getDatabase = dbName => {
      for (const x of this.DBs) {
        // const key = x._caseSensitive ? dbName : dbName.toLowerCase();
        if (x.name === dbName.trim()) return x;
      }
      return null;
    };
  }

  return {
    Typeahead,
    TriggerMatch,
    Trigger,
    Database
  };
})();
