import React from 'react';

/**
 * Normalizes persons into lookup maps by ID and by lowercase Name.
 */
function buildPersonLookups(personsSource: Map<string, any> | any[] | Record<string, any> | undefined) {
  const idMap = new Map<string, any>();
  const nameMap = new Map<string, any>();
  const personsList: any[] = [];

  if (!personsSource) {
    return { idMap, nameMap, sortedNames: [] };
  }

  if (personsSource instanceof Map) {
    personsSource.forEach((person, id) => {
      if (person) {
        idMap.set(String(id), person);
        if (person.id) idMap.set(String(person.id), person);
        if (person.name) {
          nameMap.set(person.name.trim().toLowerCase(), person);
          personsList.push(person);
        }
      }
    });
  } else if (Array.isArray(personsSource)) {
    personsSource.forEach(person => {
      if (person) {
        if (person.id) idMap.set(String(person.id), person);
        if (person.name) {
          nameMap.set(person.name.trim().toLowerCase(), person);
          personsList.push(person);
        }
      }
    });
  } else if (typeof personsSource === 'object') {
    Object.entries(personsSource).forEach(([id, person]) => {
      if (person) {
        idMap.set(String(id), person);
        if ((person as any).id) idMap.set(String((person as any).id), person);
        if ((person as any).name) {
          nameMap.set((person as any).name.trim().toLowerCase(), person);
          personsList.push(person);
        }
      }
    });
  }

  // Deduplicate and sort names descending by length so longer names match first
  const uniqueNames = Array.from(new Set(personsList.map(p => p.name.trim()))).filter(Boolean);
  uniqueNames.sort((a, b) => b.length - a.length);

  return { idMap, nameMap, sortedNames: uniqueNames };
}

/**
 * Escapes regex special characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Parses a string for mentions:
 * - Legacy format: @[Name](person:id) -> rendered as clean @Name without person ID
 * - Bracket format: @[Name] -> rendered as clean @Name
 * - Plain format: @Name (where Name matches a known person)
 * 
 * Returns an array of React nodes with clickable buttons navigating to the person's profile.
 */
export const renderMentions = (
  text: string | undefined,
  personsSource: Map<string, any> | any[] | Record<string, any> | undefined,
  onMentionClick: (personId: string) => void
) => {
  if (!text) return null;

  const { idMap, nameMap, sortedNames } = buildPersonLookups(personsSource);

  // Construct combined regex:
  // 1. @\[([^\]]+)\](?:\(person:([^)]+)\))? -> matches @[Name](person:id) OR @[Name]
  // 2. @(ExactKnownName) -> matches known names preceded by @
  const patterns: string[] = ['@\\[([^\\]]+)\\](?:\\(person:([^)]+)\\))?'];

  if (sortedNames.length > 0) {
    const namesAlternation = sortedNames.map(escapeRegex).join('|');
    // Match @Name when preceded by start of line, whitespace, or punctuation
    patterns.push(`(?<=^|[\\s(.,;!?:])@(${namesAlternation})(?=$|[\\s).,;!?:])`);
  }

  const combinedRegex = new RegExp(patterns.join('|'), 'gi');
  const parts: (string | React.ReactNode)[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = combinedRegex.exec(text)) !== null) {
    const matchStart = match.index;
    const matchEnd = combinedRegex.lastIndex;

    // Push the text before the mention
    if (matchStart > lastIndex) {
      parts.push(text.substring(lastIndex, matchStart));
    }

    let personName = '';
    let personId = '';
    let personObj: any = null;

    if (match[1]) {
      // Matched @[Name] or @[Name](person:id)
      personName = match[1];
      const explicitId = match[2];
      if (explicitId) {
        personId = explicitId;
        personObj = idMap.get(explicitId);
      }
      if (!personObj) {
        personObj = nameMap.get(personName.trim().toLowerCase());
        if (personObj) personId = personObj.id;
      }
    } else if (match[3]) {
      // Matched @KnownName directly
      personName = match[3];
      personObj = nameMap.get(personName.trim().toLowerCase());
      if (personObj) personId = personObj.id;
    }

    if (personId && personObj) {
      // Render interactive button without exposing person code/id
      parts.push(
        <button
          key={`mention-${matchStart}-${personId}`}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMentionClick(personId);
          }}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 my-0.5 mx-0.5 rounded-md bg-[#FFD700]/10 text-[#FFD700] hover:bg-[#FFD700]/20 font-semibold transition-colors cursor-pointer group align-baseline border border-[#FFD700]/20 text-xs sm:text-sm select-none"
          title={`View profile of ${personName}`}
        >
          <span className="group-hover:underline underline-offset-2">@{personName}</span>
        </button>
      );
    } else if (personName) {
      // Render as styled mention pill even if ID was unresolvable
      parts.push(
        <span
          key={`mention-${matchStart}-raw`}
          className="inline-flex items-center px-1.5 py-0.5 my-0.5 mx-0.5 rounded-md bg-white/10 text-[#FFD700] font-semibold text-xs sm:text-sm align-baseline"
        >
          @{personName}
        </span>
      );
    } else {
      parts.push(match[0]);
    }

    lastIndex = matchEnd;
  }

  // Push remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts;
};

/**
 * Removes all person codes, turning @[Name](person:id) and @[Name] into clean @Name.
 * Useful for copying or plain text display without any code exposure.
 */
export const cleanMentions = (text: string | undefined): string => {
  if (!text) return '';
  return text
    .replace(/@\[([^\]]+)\](?:\(person:[^)]+\))?/g, '@$1')
    .replace(/@\(([^)]+)\)/g, '@$1');
};
