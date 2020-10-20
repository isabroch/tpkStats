function title(string) {
  return string.replace(/^\w/, (letter) => letter.toUpperCase());
}

async function getPageAsDOM(url) {
  const response = await fetch(url);
  const textHTML = await response.text();
  const html = new DOMParser().parseFromString(textHTML, "text/html");

  return html;
}

async function getCharacterSheet(url) {
  const doc = await getPageAsDOM(url);

  var html = doc.querySelector(".cs-feats").children;

  var sheetInfo = {};
  let currentSection = null;

  for (let i = 0; i < html.length; i++) {
    const el = html[i];

    if (el.textContent.includes("craft")) {
      break;
    }

    if (el.tagName === "SUBHEADER") {
      currentSection = el.textContent;
      sheetInfo[currentSection] = [];
    } else if (el.tagName === "OL") {
      let items = [...el.children].map((item) => {
        let nodes = [...item.childNodes];

        let name;
        let description = "";
        let tags = [...el.querySelectorAll("tech")]
          .map((tag) => `[codeline]${tag.textContent}[/codeline]`)
          .join(", ");

        for (let i = 0; i < nodes.length; i++) {
          const node = nodes[i];

          // ignore empty nodes
          if (node.textContent.trim() === "") {
            continue;
          }

          // feat is name OR there's no name yet
          if (node.tagName === "FEAT" || name === undefined) {
            name = node.textContent;
          }

          // description - works with techs that are wrapped inside p tags
          else if (node.tagName !== "TECH") {
            description += node.innerHTML
              ? node.innerHTML.replace(/<tech>.*?<\/tech>/gi, "")
              : node.textContent;
          }
        }

        return `[spoiler=${name}]${`${description.trim()}
${tags}`.trim()}[/spoiler]`;
      });
      sheetInfo[currentSection].push(...items);
    }
  }

  var accuracy = [...doc.querySelectorAll(".cs-weapon-rank")].map(
    (el, index) => `${index === 0 ? "Melee" : "Ranged"} (${el.textContent})`
  );
  var techs = [...doc.querySelectorAll(".cs-tech")].map((el) => {
    let techIcon = el.querySelector(".cs-tech-type i").className;
    let type = null;

    if (techIcon.includes("axe")) type = "OFF";
    if (techIcon.includes("shield")) type = "DEF";
    if (techIcon.includes("plus")) type = "SUP";
    if (techIcon.includes("paw")) type = "COM";

    let name = title(el.querySelector(".cs-tech-name").textContent);
    let prof = el.querySelector(".cs-tech-prof").textContent;

    return `${type}. ${name} (${prof})`;
  });
  var stats = () => {
    const scriptText = doc.scripts[16].textContent;
    const regex = /<div class="pstatdesc">(.*?)<\/div>\n<div class="pstatmod">(.*?)<\/div>/gm;

    const matches = [...scriptText.matchAll(regex)];

    const stats = matches.map(
      ([match, stat, prof]) => `${stat.toUpperCase()} (${prof})`
    );

    return stats;
  };

  var build = { ...sheetInfo, accuracy, techs, stats: stats() };

  return build;
}

async function getCharacterInventory(url) {
  const doc = await getPageAsDOM(url);

  const ac = doc.querySelectorAll(".inv-stat-num")[0].textContent;
  const hp = doc.querySelectorAll(".inv-stat-num")[1].textContent;

  const inventoryHTML = doc.querySelector(".inv-section").children;
  let inventory = {};

  let currentSection = null;

  for (let i = 0; i < inventoryHTML.length; i++) {
    const el = inventoryHTML[i];
    if (el.textContent === "crafting") {
      break;
    }

    if (el.localName === "subheader") {
      currentSection = el.textContent;
      inventory[currentSection] = [];
    } else if (el.className === "inv-item") {
      let rank = el.children[1].textContent.trim();
      let name;
      let description = "";
      let tags = [...el.children[2].querySelectorAll("tech")]
        .map((tag) => `[codeline]${tag.textContent}[/codeline]`)
        .join(", ");
      for (const node of [...el.children[2].childNodes]) {
        if (node.tagName === "SUBHEADER") {
          name = node.textContent;
        } else if (node.tagName !== "TECH") {
          description += node.innerHTML
            ? node.innerHTML.replace(/<tech>.*?<\/tech>/gi, "")
            : node.textContent;
        }
      }

      description = new DOMParser()
        .parseFromString(description, "text/html")
        .body.textContent.replace(/\s+(end_)?bbc_codeline\s+/gi, " ")
        .trim();

      inventory[currentSection].push(
        `[spoiler=${name} (‎${rank}‎)]${`${description}
${tags}`.trim()}[/spoiler]`.trim()
      );
    }
  }

  const build = {
    hp,
    ac,
    ...inventory,
  };

  return build;
}

async function build(characterSheetURL, inventoryURL) {
  try {
    let { stats, accuracy, techs, ...sheet } = await getCharacterSheet(
      characterSheetURL
    );
    let { hp, ac, ...inventory } = await getCharacterInventory(inventoryURL);

    let output = `[dohtml]<style>.ibInstaStat details:not([open]) + br {display: none;}</style> <div class="ibInstaStat"[/dohtml][bdark]
${hp} HP | ${ac} AC

${accuracy.join(", ")}

${stats.join(", ")}

${techs.join(", ")}

${Object.entries(sheet)
  .map(
    (section) =>
      `[b]${section[0].toUpperCase()}[/b]
${section[1].join("\n")}`
  )
  .join("\n\n")}

${Object.entries(inventory)
  .map(
    (section) =>
      `[b]${section[0].toUpperCase()}[/b]
${section[1].join("\n")}`
  )
  .join("\n\n")}
[/bdark][dohtml]</div>[/dohtml]`;

    return output;
  } catch (error) {
    alert(error);
    throw error;
  }
}

async function handleSubmit(e) {
  e.preventDefault();

  document.querySelector("#outputWITHDESC").innerText = "Loading...";

  const data = new FormData(e.target);

  let profileURL = data.get("profileLink");

  buildFromProfile(profileURL).then(
    (output) => (document.querySelector("#outputWITHDESC").innerText = output)
  );
}

async function buildFromProfile(url) {
  let profile = await getPageAsDOM(url);
  let [sheetURL, inventoryURL] = [
    ...profile.querySelectorAll(".cpnavin a"),
  ].map((el) => el.href);

  return await build(sheetURL, inventoryURL);
}

document
  .querySelector("#characterLinksWITHDESC")
  .addEventListener("submit", handleSubmit);
