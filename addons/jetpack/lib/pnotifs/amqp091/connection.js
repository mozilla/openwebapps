/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is AMQP 0-9-1 Client Library.
 *
 * The Initial Developer of the Original Code is
 * the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *  Alex Amariutei <aamariutei@mozilla.com>
 *  Philipp von Weitershausen <philipp@weitershausen.de>
 *  Paul Sawaya <me@paulsawaya.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */
 
const {Cc,Ci,Cr,Cu,components} = require("chrome");

const constants = require("pnotifs/amqp091/constants");

//TODO: is there a better way of Cu.import-ing in jetpack?
const NetUtil = Cu.import("resource:///modules/NetUtil.jsm").NetUtil;
const Services = Cu.import("resource://gre/modules/Services.jsm").Services;
const XPCOMUtils = Cu.import("resource://gre/modules/XPCOMUtils.jsm").XPCOMUtils;

const EXPORTED_SYMBOLS = ["Connection", "StreamSerializer",
                          "StreamDeserializer"];

const BinaryInputStream = components.Constructor(
  "@mozilla.org/binaryinputstream;1",
  "nsIBinaryInputStream",
  "setInputStream");

const BinaryOutputStream = components.Constructor(
    "@mozilla.org/binaryoutputstream;1",
    "nsIBinaryOutputStream",
    "setOutputStream");

function Channel(connection, channelNumber, openCallback) {
  // Connection will be used as a transport for this channel.
  this._conn = connection; 
  this._nextChannelNumber = channelNumber;

  // Method called when an OpenOk is received for this channel.
  this._onOpen = openCallback;
  //each channel can have multiple queues and each queue
  //currently has one consumer responsible for it.
  this._availableQueues = {};
  this._consumerCallbacks = {};   
};

Channel.prototype = {

  basic_ack: function basic_ack(delivery_tag) {
    let args = [delivery_tag, 
                0]; //reserved by amqp

    let ackPayload = new MethodPayload(constants.BASIC_CLASS, constants.BASIC_ACK,
                                       args);
    let ackFrame = new Frame(constants.FRAME_TYPE_METHOD, this._nextChannelNumber,
                             ackPayload);
    this._conn.sendFrame(ackFrame);
  },
  
  onOpenOK: function onOpenOK() {
    this._onOpen(this);
  },
 
  getQueue: function getQueue(queueName) {
    return this._availableQueues[queueName]; 
  },

  declareQueue: function declareQueue(queueName, passive, durable, exclusive,
                                      autodelete, nowait, extraArguments,
                                      declareCallback) {
    this._availableQueues[queueName] = new Queue(queueName, declareCallback);

    let args = [0, // Reserved by amqp
                queueName,
                2, // 4 bits representing passive, durable, exclusive, auto-delete 
                0];// This represents an empty table. extra args that we don't use

    let queueDeclarePayload = new MethodPayload(constants.QUEUE_CLASS, constants.QUEUE_DECLARE,
                                                args);
    let queueDeclareFrame = new Frame(constants.FRAME_TYPE_METHOD, this._nextChannelNumber,
                                      queueDeclarePayload);
    this._conn.sendFrame(queueDeclareFrame);
  },

  onDeclareQueueOK: function onDeclareQueueOK(name) {
    this._availableQueues[name].onQueueDeclareOK(this);
  },
 
  consume: function consume(consumerName, consumeCallback, queueName ) {
    let args = [0,//reserved by amqp
                queueName,
                consumerName,
                0,//additional bits to set. we don't use them
                0];//empty arguments. 

    this._consumerCallbacks[consumerName] = consumeCallback;
    let consumePayload = new MethodPayload(constants.BASIC_CLASS, constants.BASIC_CONSUME, args);
    let consumeFrame = new Frame(constants.FRAME_TYPE_METHOD, this._nextChannelNumber,
                                  consumePayload);

    this._conn.sendFrame(consumeFrame);
  },

  onConsume: function onConsume(consumer, message, delivery_tag) {
    let callback = this._consumerCallbacks[consumer];
    callback(message, delivery_tag);
  } 
};

function Queue(queueName, queueDeclareCallback) {
  this._onQueueDeclare = queueDeclareCallback;
  this._queueName = queueName;
}

Queue.prototype = {
  onQueueDeclareOK: function onQueueDeclareOK(channel) {
    this.channel = channel;
    this._onQueueDeclare(channel);
  }
  // TODO: Implement other methods relevant to the AMQP Queue.
};

/**
 * 
 * Use this object to create a new connection to an AMQP server at 'host'
 * and 'port':
 * 
 *   let connection = new Connection("localhost", 5672);
 * 
 * Then create a new channel like this:
 * 
 *   connection.openChannel(function (channel) {
 *     ...
 *   });
 * 
 */

function Connection(host, port) {
  this.host = host;
  this.port = port;
}
Connection.prototype = {

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIInputStreamCallback]),

  open: function open(callback) {
    this._open_callback = callback;

    // TODO: Make global lazy service getter. gTransportService
    let transport = Cc["@mozilla.org/network/socket-transport-service;1"]
                      .getService(Ci.nsISocketTransportService);

    //XXX error handling?
    this.socket = transport.createTransport(null, 0, this.host, this.port, null);
    this.inputStream = this.socket.openInputStream(0, 0, 0);
    this.outputStream = this.socket.openOutputStream(0, 0, 0);

    this.deserializer = new StreamDeserializer(this.inputStream);
    this.serializer = new StreamSerializer(this.outputStream);

    this.inputStream.asyncWait(this, 0, 0, Services.tm.currentThread);
    this.sendProtocolHeader();

    this._channels = []; 
    this._nextChannelNumber = constants.STARTING_CHANNEL; 
    this._channels[constants.RESERVED_CHANNEL] = null; 
  },

  close: function close() {
    this.socket.close();
  },
  
  createChannel: function createChannel(onChannelOpen) {

    //create a new channel with the next available channel number, using the
    let newChannel = new Channel(this, this._nextChannelNumber, onChannelOpen);    
    this._channels[this._nextChannelNumber] = newChannel; 
    
    let args = [""]; //reserved.we're going to send a byte of 0 based on rabbitmq. 

    let startOKpayload = new MethodPayload(constants.CHANNEL_CLASS, constants.CHANNEL_OPEN, args);
    let startOKframe = new Frame(constants.FRAME_TYPE_METHOD, 
                                 this._nextChannelNumber, 
                                 startOKpayload);
    startOKframe.marshal(this.serializer); 
    this.outputStream.flush();
    this._nextChannelNumber += 1;
  },

  sendFrame: function sendFrame(frame){
    frame.marshal(this.serializer);
    this.outputStream.flush(); 
  },

  sendProtocolHeader: function sendProtocolHeader() {
    let header = new ProtocolHeader();
    header.marshal(this.serializer);
    this.outputStream.flush();
  },

  sendStartOK: function sendStartOK(conStartFrame) {
    let args = [{product:"Mozilla Firefox AMQP Client"}, // Name;
                "PLAIN", // Encoding
                "\x00" + "guest" + "\x00" + "guest", // Default username/pass
                "en_US"]; // Language
    // TODO: Make this channel a constant
    let startOKpayload = new MethodPayload(constants.CONNECTION_CLASS, constants.CONNECTION_STARTOK,args);
    let startOKframe = new Frame(constants.FRAME_TYPE_METHOD, constants.RESERVED_CHANNEL, startOKpayload);
    startOKframe.marshal(this.serializer); 
    this.outputStream.flush();
  },

  sendTuneOK: function sendTuneOK(conTuneFrame) {

    let args = [0, // Max number of channels. 0 means default
                constants.MAX_FRAME_SIZE, // Max framesize of any frame sent
                0]; // Desired heartbeat delay. 0 cancels it alltogether  

    let tuneOKpayload = new MethodPayload(constants.CONNECTION_CLASS, constants.CONNECTION_TUNEOK, args);
    let tuneOKframe = new Frame(constants.FRAME_TYPE_METHOD, constants.RESERVED_CHANNEL, tuneOKpayload);
  
    tuneOKframe.marshal(this.serializer); 
    this.outputStream.flush();
  },

  sendConnect: function sendConnect()
  {
    let args = ["/", // Virtual Host path to work with
                1];   // Reserved for AMQP

    let class_id = constants.CONNECTION_CLASS;
    let method = constants.CONNECTION_OPEN;
    
    let connectPayload=new MethodPayload(constants.CONNECTION_CLASS, constants.CONNECTION_OPEN, args);
    let connectFrame=new Frame(constants.FRAME_TYPE_METHOD, constants.RESERVED_CHANNEL, connectPayload);
    connectFrame.marshal(this.serializer); 
    this.outputStream.flush();
  }, 
  
  /**
   * nsIInputStreamCallback
   */
  onInputStreamReady: function onInputStreamReady() {
    //TODO: Right not this protocol only accepts 
    // Deliver packets that only contain one method frame, one header frame
    // and at most one body frame. Eventually, this needs to be extended
    let deliverContent = {}; 

    while (this.inputStream.available()) {
      let frame = new Frame();
      frame.demarshal(this.deserializer);
      // console.log(frame);
      // console.log('frame.type: ' + Number(frame.type).toString() + ' frame.payload.class_id:' + Number(frame.payload.class_id).toString()
                      // + ' frame.payload.method_id: ' + Number(frame.payload.method_id).toString() + "\n");
      switch (frame.type) {
        case constants.FRAME_TYPE_METHOD:
          if (frame.payload.class_id == constants.CONNECTION_CLASS &&
              frame.payload.method_id == constants.CONNECTION_START ) {
            this.sendStartOK(frame); 
          } else if (frame.payload.class_id == constants.CONNECTION_CLASS &&
                     frame.payload.method_id == constants.CONNECTION_TUNE ) {
            this.sendTuneOK(frame);
            this.sendConnect();
          } else if (frame.payload.class_id == constants.CONNECTION_CLASS &&
                     frame.payload.method_id == constants.CONNECTION_OPENOK) {
            this._open_callback();
          } else if (frame.payload.class_id == constants.CHANNEL_CLASS &&
                     frame.payload.method_id == constants.CHANNEL_OPENOK ) {
            this._channels[frame.channel_number].onOpenOK();
          } else if (frame.payload.class_id == constants.QUEUE_CLASS &&
                     frame.payload.method_id == constants.QUEUE_DECLAREOK ) {
            this._channels[frame.channel_number].onDeclareQueueOK(
                                            frame.payload.args[0]);
          } else if (frame.payload.class_id == constants.BASIC_CLASS &&
                     frame.payload.method_id == constants.BASIC_DELIVER) {
            //dump(JSON.stringify(frame.payload));
            deliverContent["consumer"] = frame.payload.args[0];
            deliverContent["channel"] = frame.payload.args[1];
          }
          break;
        case constants.FRAME_TYPE_BODY:
          this._channels[frame.channel_number].onConsume(
            deliverContent.consumer,
            frame.payload.body,
            deliverContent.channel);
          break;
        case constants.FRAME_TYPE_HEADER:
          deliverContent["size"] = frame.payload.body_size;
          break;
      }
    }
    // TODO: Explain 0's.
    this.inputStream.asyncWait(this, 0, 0, Services.tm.currentThread);
  }
};

function StreamSerializer(stream) {
  if (!(stream instanceof Ci.nsIBinaryOutputStream)) {
    stream = BinaryOutputStream(stream);
  }
  this.stream = stream;
}
StreamSerializer.prototype = {

  write: function(type, value) {
    switch (type) {
      case "bytes":
        if (Array.isArray(value)) {
          this.stream.writeByteArray(value, value.length);
        } else {
          this.stream.writeBytes(value, value.length);
        }
        break;

      case "bits":
      case "octet":
        this.stream.write8(value);
        break;
      case "short":
        this.stream.write16(value);
        break;
      case "long":
        this.stream.write32(value);
        break;
      case "longlong":
        this.stream.write64(value);
        break;
      case "shortstr":
        //TODO encode 'value' as UTF-8
        // Ensure that the string isn't over 255 bytes long 
        //or contains 0 bytes.
        let end = value.indexOf('\0');
        if (end == -1) {
          end = constants.MAX_SIZE_SHORTSTR;
        }
        value = value.slice(0, end);
        this.write("octet", value.length);
        this.write("bytes", value);
        break;
      case "longstr":
        this.write("long", value.length);
        this.write("bytes", value);
        break;
      case "field":
        this.writeField(value);
        break;
      case "table":
        this.writeTable(value);
        break;
      case "array":
        this.writeArray(value);
        break;
    }
  },

  writeField: function writeField(value) {
    // TODO timestamp?
    switch (typeof value) {
      case "boolean":
        this.write("bytes", constants.DATA_TYPE.BOOL);
        this.write("octet", value ? 1 : 0);
        break;
      case "number":
        //TODO float/double
        if (number < 0xff) {
          this.write("bytes", constants.DATA_TYPE.SHORT_SHORT_UINT);
          this.write("octet", value);
        } else if (number <= 0xffff) {
          this.write("bytes", constants.DATA_TYPE.SHORT_UINT);
          this.write("short", value);
        } else if (number <= 0xffffffff) {
          this.write("bytes", constants.DATA_TYPE.LONG_UINT);
          this.write("long", value);
        } else {
          this.write("bytes", constants.DATA_TYPE.LONG_LONG_UINT);
          this.write("longlong", value);
        }                
        break;
      case "string":
        this.write("bytes", constants.DATA_TYPE.LONG_STRING);
        this.write("longstr", value);
        break;
      case "object":
        if (Array.isArray(value)) {
          this.write("bytes", constants.DATA_TYPE.FIELD_ARRAY);
          this.write("array", value);
        } else {
          this.write("bytes", constants.DATA_TYPE.FIELD_TABLE);
          this.write("table", value);
        }
        break;
    }
  },

  writeTable: function writeTable(value) {
    // Set up a temporary stream.
    let ss = Cc["@mozilla.org/storagestream;1"]
               .createInstance(Ci.nsIStorageStream);
    ss.init(constants.STREAM_SEGMENT_SIZE, constants.PR_UINT32_MAX, null);
    let outStream = ss.getOutputStream(0);
    let serializer = new StreamSerializer(outStream);

    for (let [key, val] in Iterator(value)) {
      serializer.write("shortstr", key);
      serializer.write("field", val);
    }

    // Consume the in-memory stream.
    outStream.close();
    let inStream = ss.newInputStream(0);
    let size = inStream.available();
    this.write("long", size);

    // Unfortunately can't use this.stream.writeFrom() because
    // nsBinaryOutputStream doesn't support it :( (bug XXX)
    this.write("bytes", NetUtil.readInputStreamToString(inStream, size));
  },

  //TODO code duplication with writeTable
  writeArray: function writeArray(value) {
    // Set up a temporary stream.
    let ss = Cc["@mozilla.org/storagestream;1"]
               .createInstance(Ci.nsIStorageStream);
    ss.init(constants.STREAM_SEGMENT_SIZE, constants.PR_UINT32_MAX, null);
    let outStream = ss.getOutputStream(0);
    let serializer = new StreamSerializer(outStream);

    value.forEach(function (val) {
      serializer.write("field", val);
    }, this);

    // Consume the in-memory stream.
    outStream.close();
    let inStream = ss.newInputStream(0);
    let size = inStream.available();
    this.write("long", size);
    
    this.write("bytes", NetUtil.readInputStreamToString(inStream, size));
  }

};

function StreamDeserializer(stream) {
 if (!(stream instanceof Ci.nsIBinaryInputStream)) {
    stream = BinaryInputStream(stream);
  }
  this.stream = stream;
};
StreamDeserializer.prototype = {

  read: function(type) {
    let size;
    switch (type) {
      case "bits":
      case "octet":
        return this.stream.read8();
        break;
      case "short":
        return this.stream.read16();
        break;
      case "long":
        return this.stream.read32();
        break;
      case "longlong":
        return this.stream.read64();
        break;
      case "shortstr":
        //TODO decode UTF-8
        size = this.read("octet");
        return this.stream.readBytes(size);
        break;
      case "longstr":
        size = this.read("long");
        return this.stream.readBytes(size);
        break;
      case "field":
        return this.readField();
        break;
      case "table":
        return this.readTable();
        break;
      case "array":
        return this.readArray();
        break;
    }
  },
   
  readField: function readField () {
    let type = this.stream.readBytes(1);
    switch (type) {
      case constants.DATA_TYPE.BOOL:
        return this.read("octet");
        break;
      case constants.DATA_TYPE.SHORT_SHORT_INT:  
        //TODO
        break;
      case constants.DATA_TYPE.SHORT_SHORT_UINT:
        return this.read("octet");
        break;
      case constants.DATA_TYPE.SHORT_INT:
        //TODO
        break
      case constants.DATA_TYPE.SHORT_UINT:
        return this.read("short");
        break;
      case constants.DATA_TYPE.LONG_INT:
        //TODO
        break;
      case constants.DATA_TYPE.LONG_UINT:
        return this.read("long");
        break;
      case constants.DATA_TYPE.LONG_LONG_INT:
        //TODO
        break;
      case constants.DATA_TYPE.LONG_LONG_UINT:
        return this.read("longlong");
        break;
      case constants.DATA_TYPE.FLOAT:
        //TODO
        break;
      case constants.DATA_TYPE.DOUBLE:
        //TODO
        break;
      case constants.DATA_TYPE.DECIMAL:
        //TODO
        break;
      case constants.DATA_TYPE.SHORT_STRING:
        return this.read("shortstr");
        break;
      case constants.DATA_TYPE.LONG_STRING:
        return this.read("longstr");
        break;
      case constants.DATA_TYPE.FIELD_ARRAY:
       
        break;
      case constants.DATA_TYPE.TIMESTAMP:
        //TODO
        break;
      case constants.DATA_TYPE.FIELD_TABLE:
        
        break;
      case constants.DATA_TYPE.VOID:
        //TODO
        break;
    }
  },
  
  readTable: function readTable() {
    let size = this.read("long");
    let bytes = this.stream.readBytes(size);

    let inStream = Cc["@mozilla.org/io/string-input-stream;1"]
                     .createInstance(Ci.nsIStringInputStream);
    inStream.data = bytes;
    let deserializer = new StreamDeserializer(inStream);

    let table = {};
    while (inStream.available()) {
      let key = deserializer.read("shortstr");
      let value = deserializer.read("field");
      table[key] = value;
    }
    return table;
  },

  readArray: function readArray() {
    let size = this.read("long");
    let bytes = this.stream.readBytes(size);
    
    let inStream = Cc["@mozilla.org/io/string-input-stream;1"]
                     .createInstance(Ci.nsIStringInputStream);
    inStream.data = bytes;
    let deserializer = new StreamDeserializer(inStream);
    
    let array = []; 
    while (inStream.available()) {
      let item = deserializer.read("field");
      array.push(item);
    }
    return array;
  }
};


//XXX payload is an object that has a 'size' property and
// marshal()/demarshal() methods

function Frame(type, channel_number, payload) {
  this.type = type;
  this.channel_number = channel_number;
  this.payload = payload;
}
Frame.prototype = {

  marshal: function marshal(serializer) {
    serializer.write("octet", this.type);
    serializer.write("short", this.channel_number);
    this.payload.marshal(serializer);
    serializer.write("octet", constants.FRAME_END);
  },

  demarshal: function demarshal(deserializer) {
    this.type = deserializer.read("octet");
    this.channel_number = deserializer.read("short");
    switch (this.type) {
      case constants.FRAME_TYPE_METHOD:
        this.payload = new MethodPayload();
        break;
      case constants.FRAME_TYPE_HEADER:
        this.payload = new ContentHeaderPayload();
        break;
      case constants.FRAME_TYPE_BODY:
        this.payload = new BodyPayload();
        break;
      case constants.FRAME_TYPE_HEARTBEAT:
        this.payload = new HeartbeatPayload();
        break;
    }
    this.payload.demarshal(deserializer);
    let frame_end = deserializer.read("octet");

    // dump(frame_end + "\n");//TODO assert frame_end == FRAME_END
  }
};

function MethodPayload(class_id, method, args) {
  this.class_id=class_id;
  this.method=method;
  this.args=args;
}
MethodPayload.prototype = {

  marshal: function marshal(serializer) {
    // Set up a temporary stream.
    let ss = Cc["@mozilla.org/storagestream;1"]
               .createInstance(Ci.nsIStorageStream);
    ss.init(constants.STREAM_SEGMENT_SIZE, constants.PR_UINT32_MAX, null);
    let outStream = ss.getOutputStream(0);
    let tempSerializer = new StreamSerializer(outStream);

    tempSerializer.write("short", this.class_id);
    tempSerializer.write("short", this.method); 

    // TODO: User switch for the multiple ifs
    switch (this.class_id) {
      case constants.CONNECTION_CLASS:
       switch (this.method) { 
         case constants.CONNECTION_STARTOK:
           tempSerializer.write("table",    this.args[0]); 
           tempSerializer.write("shortstr", this.args[1]);
           tempSerializer.write("longstr",  this.args[2]);
           tempSerializer.write("shortstr", this.args[3]);
           break;
         case constants.CONNECTION_TUNEOK:
           tempSerializer.write("short",    this.args[0]); 
           tempSerializer.write("long",     this.args[1]);
           tempSerializer.write("short",    this.args[2]);
           break;
         case constants.CONNECTION_OPEN:
           tempSerializer.write("shortstr", this.args[0]);
           tempSerializer.write("short",    this.args[1]);
           break;
       }
       break;
      case constants.CHANNEL_CLASS:
       switch (this.method) {
         case constants.CHANNEL_OPEN:
           tempSerializer.write("shortstr", "");
           break;
       }
       break;
      case constants.QUEUE_CLASS :
       switch (this.method) {
         case constants.QUEUE_DECLARE:
           tempSerializer.write("short",    this.args[0]); 
           tempSerializer.write("shortstr" ,this.args[1]); 
           tempSerializer.write("octet",    this.args[2]);
           tempSerializer.write("long",     this.args[3]); 
           break;
       }
       break;
      case constants.BASIC_CLASS:
       switch (this.method) {
         case constants.BASIC_CONSUME:
           tempSerializer.write("short",    this.args[0]);
           tempSerializer.write("shortstr", this.args[1]);
           tempSerializer.write("shortstr", this.args[2]);
           tempSerializer.write("octet",    this.args[3]);
           tempSerializer.write("long",     this.args[4]);
           break;
         case constants.BASIC_ACK:
           tempSerializer.write("longlong", this.args[0]);
           tempSerializer.write("octet",    this.args[1]);
           break;
       }
       break;
      default:
       break;
    }    
    // Consume the in-memory stream.
    outStream.close();
    let inStream = ss.newInputStream(0);
    let size = inStream.available();
    serializer.write("long", size);
    serializer.write("bytes", 
        NetUtil.readInputStreamToString(inStream, size));  
  },

  demarshal: function demarshal(deserializer) {
    let size = deserializer.read("long");
    this.class_id = deserializer.read("short");
    this.method_id = deserializer.read("short");

    switch (this.class_id) {
      case constants.CONNECTION_CLASS:
        switch (this.method_id) {
          case constants.CONNECTION_START:
            this.args = [deserializer.read("octet"),
                         deserializer.read("octet"), 
                         deserializer.read("table"), 
                         deserializer.read("longstr"),
                         deserializer.read("longstr")];
            break;
          case constants.CONNECTION_TUNE:
            this.args = [deserializer.read("short"),
                         deserializer.read("long"),
                         deserializer.read("short")];
            break;
          case constants.CONNECTION_OPENOK:
            this.args = deserializer.stream.readBytes(size - constants.SIZE_SHORT * 2);
            break;
        }
        break;
      case constants.CHANNEL_CLASS:
        switch (this.method_id) {
          case constants.CHANNEL_OPENOK:
            this.args = deserializer.stream.readBytes(size - constants.SIZE_SHORT * 2);
            break;
        }
        break;
      case constants.QUEUE_CLASS :
        switch (this.method_id) {
          case constants.QUEUE_DECLAREOK:
            this.args = [deserializer.read("shortstr"),
                         deserializer.read("long"),
                         deserializer.read("long")];
            break;
        }
        break;
      case constants.BASIC_CLASS:
        switch (this.method_id) {
          case constants.BASIC_CONSUMEOK:
            this.args = [];
            this.args[0] = deserializer.read("shortstr");
            break;
          case constants.BASIC_DELIVER: 
            this.args = [deserializer.read("shortstr"), 
                         deserializer.read("longlong"),
                         deserializer.read("octet"),
                         deserializer.read("shortstr"),
                         deserializer.read("shortstr")];
            break;
        }
        break;
      default:
       this.args = deserializer.stream.readBytes(size - constants.SIZE_SHORT * 2);
       break;
    }
  }
};

function ContentHeaderPayload(class_id, weight, body_size, property_flags, property_list) {
  this.class_id = class_id;
  this.weight = weight;
  this.body_size = body_size;
  this.property_flags = property_flags;
  this.property_list = property_list;
}
ContentHeaderPayload.prototype = {

  marshal: function marshal(serializer) {
    let size = (constants.SIZE_SHORT*3) + constants.SIZE_LONGLONG + property_list.size;
    serializer.write("long", size);
    serializer.write("short", this.class_id);
    serializer.write("short", this.weight);
    serializer.write("longlong", this.body_size);
    serializer.write("short", this.property_flags);
  },
  
  demarshal: function demarshal(deserializer) {
    let size =  deserializer.read("long");
    this.class_id = deserializer.read("short");
    this.weight = deserializer.read("short");
    this.body_size = deserializer.read("longlong");
    this.property_flags = deserializer.read("short");
    let property1 = deserializer.read("shortstr"); //encoding of the body
  }
};

function BodyPayload(body) {
  this.body = body;
}
BodyPayload.prototype = {

  marshal: function marshal(serializer) {
    serializer.write("longstr", this.body);
  },

  demarshal: function demarshal(deserializer) {
    this.body = deserializer.read("longstr"); 
  }
};

//Not supported currently.
function HeartbeatPayload() {
}
HeartbeatPayload.prototype = {

  marshal: function marshal(serializer) {
    serializer.write("long", 0);
  },
  
  demarshal: function demarshal(deserializer) {
    deserializer.read("long");
  }
};


function ProtocolHeader() {
  //EMPTY
}
ProtocolHeader.prototype = {

  marshal: function marshal(serializer) {
    let header = "AMQP\x00";
    serializer.write("bytes", header);
    serializer.write("bytes", constants.PROTOCOL_VERSION);
  }
};

exports.Connection = Connection;