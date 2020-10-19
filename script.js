(() => {function title(string) {
  return string.replace(/^\w/, (letter) => letter.toUpperCase());
}

async function getPageAsDOM(url) {
  const response = await fetch(url);
  const textHTML = await response.text();
  const html = new DOMParser().parseFromString(textHTML, "text/html");

  return html;
}

function handleDescriptionPLS(el) {
  let name;
  let description = "";
  let tags = [...el.querySelectorAll("tech")]
    .map((tag) => `[codeline]${tag.textContent}[/codeline]`)
    .join(", ");
  for (const node of [...el.childNodes]) {
    if (node.tagName === "FEAT") {
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

  return `[spoiler=${name}]${`${description}
${tags}`.trim()}[/spoiler]`;
}

async function getCharacterSheet(url) {
  const characterSheet = await getPageAsDOM(url);

  var sections = characterSheet.querySelectorAll(".cs-feats ol");

  console.log(sections);

  var traits = [...sections[0].children].map(handleDescriptionPLS);
  var passives = [...sections[1].children].map(handleDescriptionPLS);
  var cms = [...sections[2].children].map(handleDescriptionPLS);

  var accuracy = [...characterSheet.querySelectorAll(".cs-weapon-rank")].map(
    (el, index) => `${index === 0 ? "Melee" : "Ranged"} (${el.textContent})`
  );
  var techs = [...characterSheet.querySelectorAll(".cs-tech")].map((el) => {
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
    const scriptText = characterSheet.scripts[16].textContent;
    const regex = /<div class="pstatdesc">(.*?)<\/div>\n<div class="pstatmod">(.*?)<\/div>/gm;

    const matches = [...scriptText.matchAll(regex)];

    const stats = matches.map(
      ([match, stat, prof]) => `${stat.toUpperCase()} (${prof})`
    );

    return stats;
  };

  var build = { traits, passives, cms, accuracy, techs, stats: stats() };

  console.log(build);

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
      console.log(currentSection);
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

  console.log(build);

  return build;
}

async function build(characterSheetURL, inventoryURL) {
  try {
    let {
      stats,
      accuracy,
      cms,
      passives,
      techs,
      traits,
    } = await getCharacterSheet(characterSheetURL);
    let {
      hp,
      ac,
      weapons,
      equipment,
      trinkets,
      consumables,
    } = await getCharacterInventory(inventoryURL);

    let output = `[dohtml]<style>.ibInstaStat details:not([open]) + br {display: none;}</style> <div class="ibInstaStat"[/dohtml][bdark]
${hp} HP | ${ac} AC

${accuracy.join(", ")}

${stats.join(", ")}

${techs.join(", ")}

[b]TRAITS[/b]
${traits.join("\n")}

[b]PASSIVES[/b]
${passives.join("\n")}

[b]COMBAT MANEUVERS[/b]
${cms.join("\n")}

[b]WEAPONS[/b]
${weapons.join("\n")}

[b]ARMOR[/b]
${equipment.join("\n")}

[b]TRINKETS[/b]
${trinkets.join("\n")}

[b]CONSUMABLES[/b]
${consumables.join("\n")}
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

  // let sheetURL = data.get("sheet");
  // let inventoryURL = data.get("inventory");
  let profileURL = data.get("profileLink");
  // let profileURL = "http://tpk.jcink.net/index.php?showuser=45";
  let profile = await getPageAsDOM(profileURL);
  let [sheetURL, inventoryURL] = [
    ...profile.querySelectorAll(".cpnavin a"),
  ].map((el) => el.href);

  build(sheetURL, inventoryURL).then(
    (output) => (document.querySelector("#outputWITHDESC").innerText = output)
  );
}

document
  .querySelector("#characterLinksWITHDESC")
  .addEventListener("submit", handleSubmit);}
)()