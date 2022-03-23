let KADpacket = require('./kadPTP');
let singleton = require('./Singleton');
let net = require('net');

/**
 * Returns the bucket index of peer
 * @param {String} thisPeer Hex ID for this peer
 * @param {String} connectingPeer Hex ID for peer attempting to connect
 * @returns Number of 
 */
function getBucket(thisPeerID, connectingPeerID) {
    let thisPeer = singleton.Hex2Bin(thisPeerID);
    let connectingPeer = singleton.Hex2Bin(connectingPeerID);
    let ptr = 0; // Each identifier is 160 bits, so final index is 159
    while (thisPeer.charAt(ptr) === connectingPeer.charAt(ptr) && ptr < 160) {
        ptr += 1;
    }
    return ptr;
}

module.exports = {
    peerID: "",
    dht: {},
    init: function(peerID, peerName) {
        this.peerID = peerID;
        this.peerName = peerName;
    },
    handleClientJoining: function(sock) {
        console.log(`Connected from peer ${sock.remoteAddress}:${sock.remotePort}`)

        // Send welcome message
        let welcomeMessage = KADpacket;
        // Get peer list
        let peers = this.getPeerList();
        welcomeMessage.init(7, 1, this.peerName, peers);
        sock.write(welcomeMessage.getBytePacket());

        // Push new client to appropriate bucket
        this.pushToBucket(this.dht, sock);
    },

    sendHelloMessages: function() {
        // Iterate through DHT and send messages
        let peerList = this.getPeerList();
        for (let peer of peerList) {
            console.log('sending hello');
            // Construct hello message
            let helloMessage = KADpacket;
            helloMessage.init(7, 2, this.peerName, peerList);

            // Open socket connection and send message
            let sock = net.Socket();
            sock.connect(peer[1], peer[0], () => {
                sock.write(helloMessage.getBytePacket());
                sock.destroy();
            });
        }
    },
    /**
     * Adds new peer socket to appropriate bucket in DHT table
     * @param {Object} T DHT Table
     * @param {*} sock New socket to add
     */
    pushToBucket: function(T, sock) {
        let address = sock.remoteAddress;
        let port = sock.remotePort;
        let newPeerID = singleton.getPeerID(address, port);
        let entry = [
            address,
            port,
            newPeerID
        ];
    
        // Identify bucket number
        let bucketId = getBucket(this.peerID, newPeerID);
        
        // Check if bucket is already full
        if (bucketId in T) {
            // See which one is closer, only save new one if it's closer
            let existingNode = T[bucketId];
            if (singleton.XORing(this.peerID, existingNode[2]) > singleton.XORing(this.peerID, newPeerID)) {
                T[bucketId] = entry;
            }
        } else {
            T[bucketId] = entry;
        }
    },

    getPeerList: function() {
        let peers = [];
        for (let [_, peer] of Object.entries(this.dht)) {
            peers.push(peer);
        }
        return peers;
    },

    refreshBuckets: function(T, peerList) {
        for (let peer of peerList) {
            // Attempt to place peer into DHT
            let bucketId = getBucket(this.peerID, peer[2]);
            if (bucketId in T) {
                // If the bucket is already full, see which is closer
                let existingNode = T[bucketId];
                if (singleton.XORing(this.peerID, existingNode[2]) > singleton.XORing(this.peerID, peer[2])) {
                    T[bucketId] = entry;
                }
            }
        }
    },

    viewDHT: function() {
        let peers = [];
        for (let [bucketId, peer] of Object.entries(this.dht)) {
            peers.push(peer);
        }
        return peers;
    }
}