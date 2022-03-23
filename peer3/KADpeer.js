let net = require('net');
let path = require('path');
let singleton = require('./Singleton');
let handler = require('./PeerHandler');
const kadPTP = require('./kadPTP');

singleton.init();

const HOST = '127.0.0.1';



// If -p option not specified, initialize server
let server = net.createServer();
server.listen(0, HOST, () => {
    // Generate peer ID
    const peerID = singleton.getPeerID(server.address().address, server.address().port);
    const folderName = path.basename(__dirname);
    handler.init(peerID, folderName);
    
    if (process.argv.length > 2) {
        // If -p option is specified, connect to KADpeer
        let peerServerAndPort = process.argv[3].split(":");
        let peerIP = peerServerAndPort[0];
        let peerPort = peerServerAndPort[1];
        let client = net.Socket();
        client.connect(peerPort, peerIP, () => {
            // Push receiving peer to dht
            handler.pushToBucket(handler.dht, client);

            client.on('data', data => {
                // // Handle welcome message
                let response = kadPTP.decodePacket(data);
                if (response.version === 7 && response.messageType === 1) {
                    console.log(`Connected to ${response.senderName} at timestamp ${singleton.getTimestamp()}`);
                    console.log(`Received welcome message from ${response.senderName}\n  along with DHT: ${response.peers}`);
                    
                    // Add peers to dht
                    handler.refreshBuckets(handler.dht, response.peers);
                    console.log('Refresh k-Bucket operation has been performed');

                    console.log(`My DHT:\n${handler.viewDHT()}`);               
                }
            })

        });
    }
    console.log(`This peer\'s address is ${server.address().address}:${server.address().port} located at ${folderName} [${peerID}]`);
    server.on('connection', sock => {
        if (process.argv.length <= 2) {
            // Send welcome message (if we are the server node)
            handler.handleClientJoining(sock);
        } else {
            // Add new connecting client to dht
            handler.pushToBucket(handler.dht, sock);
            // Handle Hello message
            sock.on('data', data => {
                let response = kadPTP.decodePacket(data);
                if (response.version === 7 && response.messageType === 2) {
                    console.log(`Received hello message from ${response.senderName}\n  along with DHT: ${response.peers}`);

                    // Add peers to dht
                    handler.refreshBuckets(handler.dht, response.peers);
                    console.log('Refresh k-Bucket operation has been performed');

                    console.log(`My DHT:\n${handler.dht}`);
                } 
            });
        }
    })
});