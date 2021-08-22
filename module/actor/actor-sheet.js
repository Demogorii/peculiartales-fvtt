/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
export class PeculiarTalesActorSheet extends ActorSheet {

  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["peculiartales", "sheet", "actor"],
      template: "systems/peculiartales/templates/actor/actor-sheet.html",
      width: 800,
      height: 770,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }],
      resizable: false
    });
  }

  /* -------------------------------------------- */

  /** @override */
  getData() {
    const data = super.getData().data;
    data.dtypes = ["String", "Number", "Boolean"];
    for (let attr of Object.values(data.data.attributes)) {
      attr.isCheckbox = attr.dtype === "Boolean";
    }

    data.actor = super.getData().actor;

    // Prepare items.
    if (this.actor.data.type == 'character') {
      this._prepareCharacterItems(data);
    }

    return data;
  }

  /**
   * Organize and classify Items for Character sheets.
   *
   * @param {Object} actorData The actor to prepare.
   *
   * @return {undefined}
   */
  _prepareCharacterItems(sheetData) {
    const actorData = sheetData.actor;

    // Initialize containers.
    const gear = [];
    const contacts = [];

    // Iterate through items, allocating to containers
    // let totalWeight = 0;
    for (let i of sheetData.items) {
      let item = i.data;
      i.img = i.img || DEFAULT_TOKEN;
      // Append to gear.
      if (i.type === 'item') {
        gear.push(i);
      }
      // Append to features.
      else if (i.type === 'contact') {
        contacts.push(i);
      }
    }

    // Assign and return
    actorData.gear = gear;
    actorData.contacts = contacts;
    actorData.game = game;
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return;

    // Add Inventory Item
    html.find('.item-create').click(this._onItemCreate.bind(this));

    // Update Inventory Item
    html.find('.item-edit').click(ev => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.getOwnedItem(li.data("itemId"));
      item.sheet.render(true);
    });

    // Delete Inventory Item
    html.find('.item-delete').click(ev => {
      const li = $(ev.currentTarget).parents(".item");
      this.actor.deleteOwnedItem(li.data("itemId"));
      li.slideUp(200, () => this.render(false));
    });

    // Rollable abilities.
    html.find('.rollable').click(this._onRoll.bind(this));

    // Drag events for macros.
    if (this.actor.owner) {
      let handler = ev => this._onDragStart(ev);
      html.find('li.item').each((i, li) => {
        if (li.classList.contains("inventory-header")) return;
        li.setAttribute("draggable", true);
        li.addEventListener("dragstart", handler, false);
      });
    }
  }

  /**
   * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
   * @param {Event} event   The originating click event
   * @private
   */
  _onItemCreate(event) {
    event.preventDefault();
    const header = event.currentTarget;
    // Get the type of item to create.
    const type = header.dataset.type;
    // Grab any data associated with this control.
    const data = duplicate(header.dataset);
    // Initialize a default name.
    const name = `New ${type.capitalize()}`;
    // Prepare the item object.
    const itemData = {
      name: name,
      type: type,
      data: data
    };
    // Remove the type from the dataset since it's in the itemData.type prop.
    delete itemData.data["type"];

    // Finally, create the item!
    return this.actor.createOwnedItem(itemData);
  }

  /**
   * Handle clickable rolls.
   * @param {Event} event   The originating click event
   * @private
   */
  _onRoll(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const dataset = element.dataset;

    if (dataset.roll) {

      async function drawCardWait(){
        let cardid = game.playerdeck.infiniteDraw();
        let card = await game.playerdeck.getCardData(cardid);
        card.id = cardid;
        return card;
      }

      drawCardWait().then(boostedCard => {
        drawCardWait().then(card => {
          let result = this._getCardDetails(card, dataset.label);

          let value = result.cardvalue;
          let textLabel = dataset.label;
          if (dataset.label.includes("."))
          {
            textLabel = textLabel.split(".")[1];
          }
          let pretext = textLabel[0].toUpperCase() + textLabel.slice(1).toLowerCase();

          if (pretext === "Fasttalking")
            pretext = "Fast Talking";

          if (pretext === "Lowtech")
            pretext = "Low Tech";

          if (pretext === "Hightech")
            pretext = "High Tech";
          let label = dataset.label ? `<h2>${pretext} check...</h2>` : '';

          let labelPreboost = label + "<h3>Drew <b>" + result.cardname + "</b>!</h3>"

          let labelPostboost = "" ;

          if (result.boosting && game.playerdeck._state.length > 1){

            if (boostedCard.id === card.id)
            {
                console.log("PT | DUPLICATE CARD FOR BOOSTING. ROLLING ANOTHER.");
                this._onRoll(event);
                return;
            }

            let boostingCardDetails = this._getCardDetails(boostedCard, dataset.label);
            labelPostboost = '<h3><span style="color:red"><b>Boosted</b> </span> with <b>' + boostingCardDetails.cardname + "</b>!</h3>";
            value = value + boostingCardDetails.cardvalue;
          }

          let dataroll = {...this.actor.data.data, drawvalue: value}
          let roll = new Roll(dataset.roll, dataroll);

          let flavor = labelPreboost + labelPostboost;

          let cardjournal = game.journal.get(card.id);
          let boostedcardjournal = game.journal.get(boostedCard.id);

          flavor += '<img style="width: 50%;" src="' + cardjournal.data.img + '" />';

          if (labelPostboost)
          {
            flavor += '<img style="width: 50%;" src="' + boostedcardjournal.data.img + '" />';
          }

          roll.roll().toMessage({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            flavor: flavor
          });
        });
      });
    }
  }

  _getCardDetails(card, label){
    let cardname = "";
    let cardvalue = 0;
    let boosting = false;
    let skillsuit = "";
    if (this.actor.data.data.abilities[label]){
        skillsuit = this.actor.data.data.abilities[label].suit;
    } else {
        let str = label.split(".");
        if (str && str[0] && str[1]){
            skillsuit = this.actor.data.data.abilities[str[0]].suit;
        }
    }

    if (card.value === "JOKER") {
      cardname = "a " + card.suit + " JOKER";
      cardvalue = 10;
    }
    else if (card.value === 11){
      cardname = "a Jack of " + card.suit;
      cardvalue = 5;
      if (card.suit === skillsuit){
        boosting = true;
      }
      let status = this._updateCardForStatus(card, label, cardname, cardvalue);
      cardname = status.cardname;
      cardvalue = status.cardvalue;
    }
    else if (card.value === 12){
      cardname = "a Queen of " + card.suit;
      cardvalue = 5;
      if (card.suit === skillsuit){
        boosting = true;
      }
      let status = this._updateCardForStatus(card, label, cardname, cardvalue);
      cardname = status.cardname;
      cardvalue = status.cardvalue;
    }
    else if (card.value === 13){
      cardname = "a King of " + card.suit;
      cardvalue = 5;
      if (card.suit === skillsuit){
        boosting = true;
      }
      let status = this._updateCardForStatus(card, label, cardname, cardvalue);
      cardname = status.cardname;
      cardvalue = status.cardvalue;
    }
    else if (card.value === 1){
      cardname = "an Ace of " + card.suit;
      cardvalue = 1;
      if (card.suit === skillsuit){
        boosting = true;
      }
    }
    else{
      cardname = "a " + card.value + " of " + card.suit;
      cardvalue = card.value;
      if (card.suit === skillsuit){
        boosting = true;
      }
    }

    if (this.actor.data.data.attributes.afraid.value){
      cardname = cardname + " (afraid: no river)";
    }
    if (this.actor.data.data.attributes.injured.value){
        cardname = "" + cardname + " (injured: need teamwork)";
    }

    return { cardname: cardname, cardvalue: cardvalue, boosting: boosting};
  }

  _updateCardForStatus(card, label, cardname, cardvalue){

    if (this.actor.data.data.attributes.fatigued.value)
    {
      if (label.includes("body") || label.includes("quickness"))
      {
        cardvalue = 0;
        cardname = "<s>" + cardname + "</s> (fatigued)";
      }
    }
    if (this.actor.data.data.attributes.angry.value)
    {
      if (label.includes("mind") || label.includes("resolve"))
      {
        cardvalue = 0;
        cardname = "<s>" + cardname + "</s> (angry)";
      }
    }

    return {cardname: cardname, cardvalue: cardvalue};
  }
}
