// Originally by neilj, modified by Kyle Maas
// From https://gist.github.com/neilj/4146038
// Licensed as MIT according to https://gist.github.com/neilj/4146038#gistcomment-1419106
// Newer version available here, but it requires other chunks of code from that project:
// https://github.com/fastmail/overture/blob/2c86c8fa50e5d915b51fcc331f7dcd8a5d4559ae/source/application/WindowController.js

function WindowController () {
    this.id = (new Date()).getTime()
    this.isMaster = false;
    this.others = {};

    window.addEventListener( 'storage', this, false );
    window.addEventListener( 'unload', this, false );

    this.broadcast( 'hello' );

    var that = this;
    var check = function check () {
        that.check();
        that._checkTimeout = setTimeout( check, 10000 );
    };
    var ping = function ping () {
        that.sendPing();
        that._pingTimeout = setTimeout( ping, 500 );
    };
    this._checkTimeout = setTimeout( check, 2000 ); // This is low so initial window opening isn't unnecessarily delayed.
    this._pingTimeout = setTimeout( ping, 500 );
}

WindowController.prototype.destroy = function () {
    clearTimeout( this._pingTimeout );
    clearTimeout( this._checkTimeout );

    window.removeEventListener( 'storage', this, false );
    window.removeEventListener( 'unload', this, false );

    this.broadcast( 'bye' );
};

WindowController.prototype.handleEvent = function ( event ) {
    if ( event.type === 'unload' ) {
        this.destroy();
    } else if ( event.key === 'broadcast' ) {
        try {
            var data = JSON.parse( event.newValue );
            if ( data.id !== this.id ) {
                this[ data.type ]( data );
                //console.log("WindowController: Received ping from other window")
            }
        } catch ( error ) {}
    }
};

WindowController.prototype.sendPing = function () {
    this.broadcast( 'ping' );
};

WindowController.prototype.hello = function ( event ) {
    this.ping( event );
    if ( event.id < this.id ) {
        this.check();
    } else {
        this.sendPing();
    }
};

WindowController.prototype.ping = function ( event ) {
    this.others[ event.id ] = +new Date();
};

WindowController.prototype.bye = function ( event ) {
    delete this.others[ event.id ];
    this.check();
};

WindowController.prototype.check = function ( event ) {
    var now = +new Date(),
        takeMaster = true,
        id;
    for ( id in this.others ) {
        if ( this.others[ id ] + 23000 < now ) {
            delete this.others[ id ];
            console.log("WindowController: Other peer is dead")
        } else if ( id < this.id ) {
            takeMaster = false;
            //console.log("WindowController: Yielding to older peer")
        }
    }
    if ( this.isMaster !== takeMaster ) {
        this.isMaster = takeMaster;
        this.masterDidChange();
        console.log("WindowController: Taking over")
    }
};

WindowController.prototype.masterDidChange = function () {};

WindowController.prototype.broadcast = function ( type, data ) {
    var event = {
        id: this.id,
        type: type
    };
    for ( var x in data ) {
        event[x] = data[x];
    }
    try {
        localStorage.setItem( 'broadcast', JSON.stringify( event ) );
    } catch ( error ) {}
};

module.exports.WindowController = WindowController
