// Import Modules
import { PeculiarTalesActor } from "./actor/actor.js";
import { PeculiarTalesActorSheet } from "./actor/actor-sheet.js";
import { PeculiarTalesItem } from "./item/item.js";
import { PeculiarTalesItemSheet } from "./item/item-sheet.js";
import { Deck } from "./../../../modules/cardsupport/scripts/deck.js"

Hooks.once('init', async function() {

  game.peculiartales = {
    PeculiarTalesActor,
    PeculiarTalesItem,
    rollItemMacro
  };

  /**
   * Set an initiative formula for the system
   * @type {String}
   */
  CONFIG.Combat.initiative = {
    formula: "@initiativeRoll",
    decimals: 2
  };

  // Define custom Entity classes
  CONFIG.Actor.entityClass = PeculiarTalesActor;
  CONFIG.Item.entityClass = PeculiarTalesItem;

  // Register sheet application classes
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("peculiartales", PeculiarTalesActorSheet, { makeDefault: true });
  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("peculiartales", PeculiarTalesItemSheet, { makeDefault: true });

  // If you need to add Handlebars helpers, here are a few useful examples:
  Handlebars.registerHelper('concat', function() {
    var outStr = '';
    for (var arg in arguments) {
      if (typeof arguments[arg] != 'object') {
        outStr += arguments[arg];
      }
    }
    return outStr;
  });

  Handlebars.registerHelper('toLowerCase', function(str) {
    return str.toLowerCase();
  });

  Handlebars.registerHelper('summarize', function(str) {
    let strippedString = str.replace(/(<([^>]+)>)/gi, "");
    var firstLine = strippedString.split('\n')[0];
    return firstLine;
  });
});

Hooks.once("decks.ready", async function(){
 const gmdeckid = game.folders.find((el) => el.name == "GMDeck");
  if (!gmdeckid && game.user.isGM) {
    console.log("PT | Create GM Deck");
    let sampleDeckBlob = await (
      await fetch("systems/peculiartales/decks/GMDeck.zip")
    ).blob();
    let sampleDeckFile = new File([sampleDeckBlob], "GMDeck.zip");
    let deckImgBlob = await (
      await fetch(`systems/peculiartales/decks/gm_back.png`)
    ).blob();
    let deckImgFile = new File([deckImgBlob], "deckimg.png");
    let deck = game.decks.create(sampleDeckFile, deckImgFile);
    deck.then(d => {
      game.gmdeck = game.decks.get(d);
      game.gmdeck.shuffle();
    });
  }
  else {
    game.gmdeck = new Deck(game.decks.get(gmdeckid._id));
  }

  const playerdeckid = game.folders.find((el) => el.name == "PlayerDeck");
  if (!playerdeckid && game.user.isGM) {
    console.log("PT | Create Player Deck");
    let sampleDeckBlob = await (
      await fetch("systems/peculiartales/decks/PlayerDeck.zip")
    ).blob();
    let sampleDeckFile = new File([sampleDeckBlob], "PlayerDeck.zip");
    let deckImgBlob = await (
      await fetch(`systems/peculiartales/decks/player_back.png`)
    ).blob();
    let deckImgFile = new File([deckImgBlob], "deckimg.png");
    let deck = game.decks.create(sampleDeckFile, deckImgFile);
    deck.then(d => {
      game.playerdeck = game.decks.get(d);
      game.playerdeck.shuffle();
    });
  }
  else{
    game.playerdeck = new Deck(game.decks.get(playerdeckid._id));
  }
});

Hooks.once("ready", async function() {
  // Wait to register hotbar drop hook on ready so that modules could register earlier if they want to
  Hooks.on("hotbarDrop", (bar, data, slot) => createPeculiarTalesMacro(data, slot));


});

/* -------------------------------------------- */
/*  Hotbar Macros                               */
/* -------------------------------------------- */

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Promise}
 */
async function createPeculiarTalesMacro(data, slot) {
  if (data.type !== "Item") return;
  if (!("data" in data)) return ui.notifications.warn("You can only create macro buttons for owned Items");
  const item = data.data;

  // Create the macro command
  const command = `game.peculiartales.rollItemMacro("${item.name}");`;
  let macro = game.macros.entities.find(m => (m.name === item.name) && (m.command === command));
  if (!macro) {
    macro = await Macro.create({
      name: item.name,
      type: "script",
      img: item.img,
      command: command,
      flags: { "peculiartales.itemMacro": true }
    });
  }
  game.user.assignHotbarMacro(macro, slot);
  return false;
}

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {string} itemName
 * @return {Promise}
 */
function rollItemMacro(itemName) {
  const speaker = ChatMessage.getSpeaker();
  let actor;
  if (speaker.token) actor = game.actors.tokens[speaker.token];
  if (!actor) actor = game.actors.get(speaker.actor);
  const item = actor ? actor.items.find(i => i.name === itemName) : null;
  if (!item) return ui.notifications.warn(`Your controlled Actor does not have an item named ${itemName}`);

  // Trigger the item roll
  return item.roll();
}
