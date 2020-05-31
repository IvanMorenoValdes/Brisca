import Baraja from '../Cartas/Baraja'
import Naipe from '../Cartas/Naipe'
import Jugador from '../Entidades/Jugador'
import machina = require('machina')
import _ = require('lodash')
import Palo from '../Cartas/Palo'


enum ActionType {
    CardDelivered = "CardDelivered",
    PlayerWonRound = "PlayerWonRound"
}

interface ActionInterface {
    action: ActionType
}
/**
 * Class that encodes the rules for the card game Brisca
 * 
 */

export default class Brisca {
    public gameFSM: machina.Fsm
    private deck: Baraja
    private players: Jugador[] = []

    //private emitter:EventEmitter = new EventEmitter

    /** Map from card number to worth in points. Cards not in the map are worth 0 points
     * and which wins is determined by their numerical ordering
     */
    private pointsByCard: Map<number,number> = new Map([[1,11],[3,10],[12,4],[11,3],[10,2]])

    /** This card will be taken at the end of the game */
    private cartaDeTriunfo: Naipe

    /** Palo de triunfo */
    private paloDeTriunfo: Palo

    /** Indicates whose turn to play a card is it */
    private currentPlayerTurn: number = 0

    private cardsDrawn: Naipe[]

    private roundNumber: number = 0;

    constructor (inputdeck: Baraja) {
        const numPlayers: number = 2;
        this.deck = inputdeck
        this.cardsDrawn = new Array(numPlayers).fill(null)
        this.players = new Array(numPlayers).fill(null).map(() => new Jugador());
        this.buildSM()
        
    }

    public setCallbackFunction(func){

        this.gameFSM.on('action',func)
    }

    public repartir(){
        this.gameFSM.handle("repartoInicial");
    }

    public getPlayerPoints(id: number): number{
        return _.sum(this.players[id].getWonCards().map((card) => this.pointsByCard.get(card.numero)))
    }

    public whosTurnIsIt():number {
        return this.currentPlayerTurn
    }

    public sacarCarta(playerNum: number, naipe: Naipe){
        this.gameFSM.handle('sacarCarta', {playerNum,naipe});
    }

    public getRoundNumber(): number {
        return this.roundNumber
    }

    private nextPlayerTurn() {
        this.currentPlayerTurn = ++this.currentPlayerTurn % this.players.length
    }

    private sacarCartaPrv(playerNum: number, naipe: Naipe): boolean {
        
        if (playerNum < 0 || playerNum >= this.players.length) return false;
        if (playerNum != this.currentPlayerTurn) return false;

        if (this.players[playerNum].hasCard(naipe)) {
            this.players[playerNum].takeAwayCard(naipe)
            this.cardsDrawn[playerNum] = naipe
            console.log(`Player ${playerNum} drew card ${naipe}`)
            this.nextPlayerTurn()
        } 
    }

    private allCardsDrawn(){

        return this.cardsDrawn.every((card) => card != null)
    }

    /**
     * Deals the cards
     */
    private repartoInicialPrv() {

        this.cartaDeTriunfo = this.deck.getCard()
        this.paloDeTriunfo = this.cartaDeTriunfo.palo
        this.currentPlayerTurn = 0;
        /* repartir */
        for (let player of this.players) {
            for (let i = 0; i < 3; ++i){
                let card = this.deck.getCard()
                player.addCard(card)
                this.gameFSM.emit('action', { action: ActionType.CardDelivered });
            }
        }
    }



    private verifyWinner(): number{

        if (!this.cardsDrawn.every((card) => card.palo == this.paloDeTriunfo) && 
        this.cardsDrawn.some((card) => card.palo == this.paloDeTriunfo)){
            return this.cardsDrawn.findIndex((card:Naipe) => card.palo == this.paloDeTriunfo)
        }
        else if (!this.cardsDrawn.every((card) => card.palo == this.cardsDrawn[this.currentPlayerTurn].palo)){
            return this.currentPlayerTurn
        }
        let cardValues:number[] = this.cardsDrawn.map((card) => {
            let value = this.pointsByCard.get(card.numero)
            if (value == undefined) value = 0;
            return value
        })

        if (cardValues.every((value) => value == 0)){
            let maxOrder = Math.max.apply(null,this.cardsDrawn.map(card => card.numero));
            return cardValues.indexOf(maxOrder)
        }
        else {
            let maxValue = Math.max.apply(null,cardValues);
            return cardValues.indexOf(maxValue)
        }
    }

    toString(){
        return "Carta de triunfo: " + this.cartaDeTriunfo.toString() + "\n" + this.deck.toString() + ", " +  "num cartas: " + this.deck.numCards()
    }

    buildSM () {
      let este = this;
      this.gameFSM = new machina.Fsm({

        initialize: function (options) {

        },

        initialState: 'uninitialized',

        states: {

          uninitialized: {

            repartoInicial: 'repartoInicial'

          },
          repartoInicial: {

            _onEnter: function(){
                este.repartoInicialPrv()
                this.transition('turno')
            }
          },
          turno: {
              
            sacarCarta: function({playerNum, naipe}: {playerNum:number, naipe:Naipe}){
                este.sacarCartaPrv(playerNum,naipe)
                if (este.allCardsDrawn()){
                    this.transition('roundEnd')
                }
            }

          },
          roundEnd: {

            _onEnter: function(){
                let winner = este.verifyWinner()
                este.cardsDrawn.forEach((card:Naipe) => {este.players[winner].addWonCard(card)})
                este.cardsDrawn.fill(null)
                this.emit('accion', {action: ActionType.PlayerWonRound, playerNum: winner})
                console.log(`Player ${winner} won round`)
                
                este.currentPlayerTurn = winner;
                for (let player of este.players){
                    player.addCard(este.deck.getCard());
                }
                ++este.roundNumber
                this.transition('turno')
            }
          },

          repartir: {


          },
          endgame: {

          }

        }
    })
    }
}
