const singleton = require("./Singleton");

const HEADER_SIZE = 4;

module.exports = {
    header: new Buffer.alloc(HEADER_SIZE),
    senderNameSize: 0,
    senderName: "",
    peers: null,
    init: function(version, messageType, senderName, peers) {
        // Build header
        storeBitPacket(this.header, version, 0, 4);
        storeBitPacket(this.header, messageType, 4, 8);
        storeBitPacket(this.header, peers.length, 12, 8);

        let senderNameBytes = stringToBytes(senderName);
        storeBitPacket(this.header, senderNameBytes.length, 20, 12);
        

        // Add sender name
        this.senderName = senderName;

        // Add list of peers
        for (let i = 0; i < peers.length; i++) {
            let IP = peers[i][0];
            let peerBuffer = Buffer.alloc(6); // 6 Bytes for buffer IP + port
            let IPList = IP.split('.');
            for (let j = 0; j < IPList.length; j++) {
                storeBitPacket(peerBuffer, parseInt(IPList[j]), j*8, 8);
            }
            // Add port number
            storeBitPacket(peerBuffer, peers[i][1], 32, 16);
            
            // Add peer to peer list
            if (this.peers) {
                this.peers = Buffer.concat([this.peers, peerBuffer]);
            } else {
                this.peers = peerBuffer;
            }
        }
    },

    /**
     * Returns the packet as a byte array
     * @returns Byte array containing entire packet
     */
    getBytePacket: function() {
        let packet;
        if (this.peers) packet = Buffer.concat([this.header, Buffer.from(this.senderName), this.peers]);
        else packet = Buffer.concat([this.header, Buffer.from(this.senderName)]);
        
        return packet;
    },

    decodePacket: function(packet) {
        let version = parseBitPacket(packet, 0, 4);
        let messageType = parseBitPacket(packet, 4, 8);
        let numPeers = parseBitPacket(packet, 12, 8);
        let senderNameLength = parseBitPacket(packet, 20, 12);

        let senderName = bytes2string(packet.slice(4, 4+senderNameLength));
        
        // Get peers
        let rcvPeers = [];
        let peerPacket = packet.slice(4 + senderNameLength);
        
        for (let i = 0; i < numPeers; i++) {
            peerIP = [];
            // Get IP address
            for (let j = 0; j < 4; j++) {
                peerIP.push(parseBitPacket(peerPacket, (48*i) + (8*j), 8));
            }
            let peerIPString = peerIP.join('.');
            peerPort = parseBitPacket(peerPacket, (48*i) + 32, 16);
            rcvPeers.push([peerIPString, peerPort, singleton.getPeerID(peerIPString, peerPort)]);
        }
        return {
            version: version,
            messageType: messageType,
            senderName: senderName,
            peers: rcvPeers
        }
    }
}


// Helper functions
function stringToBytes(str) {
    var ch,
      st,
      re = [];
    for (var i = 0; i < str.length; i++) {
      ch = str.charCodeAt(i); // get char
      st = []; // set up "stack"
      do {
        st.push(ch & 0xff); // push byte to stack
        ch = ch >> 8; // shift value down by 1 byte
      } while (ch);
      // add stack contents to result
      // done because chars have "wrong" endianness
      re = re.concat(st.reverse());
    }
    // return an array of bytes
    return re;
  }
  
// Store integer value into the packet bit stream
function storeBitPacket(packet, value, offset, length) {
    // let us get the actual byte position of the offset
    let lastBitPosition = offset + length - 1;
    let number = value.toString(2);
    let j = number.length - 1;
    for (var i = 0; i < number.length; i++) {
        let bytePosition = Math.floor(lastBitPosition / 8);
        let bitPosition = 7 - (lastBitPosition % 8);
        if (number.charAt(j--) == "0") {
        packet[bytePosition] &= ~(1 << bitPosition);
        } else {
        packet[bytePosition] |= 1 << bitPosition;
        }
        lastBitPosition--;
    }
}

function pushToBuffer(buffer, value, offset, size) {
    for (let i = offset; i < offset + size; i++) {
        buffer[i] = value[i];
    }
}

// return integer value of the extracted bits fragment
function parseBitPacket(packet, offset, length) {
    let number = "";
    for (var i = 0; i < length; i++) {
      // let us get the actual byte position of the offset
      let bytePosition = Math.floor((offset + i) / 8);
      let bitPosition = 7 - ((offset + i) % 8);
      let bit = (packet[bytePosition] >> bitPosition) % 2;
      number = (number << 1) | bit;
    }
    return number;
}

function bytes2string(array) {
    var result = "";
    for (var i = 0; i < array.length; ++i) {
        result += String.fromCharCode(array[i]);
    }
    return result;
}