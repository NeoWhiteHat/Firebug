/* See license.txt for terms of usage */
/**
 * Packet module
 *
 */

/** @ignore for Firefox module usage: */
var EXPORTED_SYMBOLS = ["EventPacket", "RequestPacket", "ResponsePacket"];

  /**
   * @description The prototype object for all other packet types.
   * Handles parsing packet strings and JSON, and generating sequence numbers.
   */
  var Packet = {
    seq: 0,
    length: 0,
    data: null,

    toJSON: function( obj) {
      //FIXME: only works for FF3.5 native JSON
      return JSON.stringify(obj);
    },

    parseJSON: function( str) {
      if (str) {
        //return eval('(' + str + ')'); //FIXME: dangerous
        return JSON.parse(str);
      }
    },

    toPacketString: function( str) {
      return "Content-Length:" + str.length + "\r\n" + str; // HTTP-ish style
      //return (str.length.toString(16)) + "\r\n" + str + "\r\n0\r\n"; // chunked-encoding style
    },

    parsePacketString: function( blob) {
      var chunks, length, message = "";
      chunks = blob.split("\r\n");
      for (var i = 0; i < chunks.length; i+=2) {
          //length = parseInt(chunks[i], 16); // chunked-style
          length = 0;
          var headers = chunks[i].split(':');
          for (var j = 0; j < headers.length; j+=2) {
            if (headers[j].indexOf("Content-Length") != -1) {
              length = parseInt(headers[j+1]);
              break;
            }
          }

          if (length > 0 && chunks[i+1].length == length)
            message += chunks[i+1];
      }
      return message;
    }
  };

  // ----- EventPacket -----
  /**
   * @description Creates a new Event Packet object.
   * @param event name of the event.
   * @param data JSON object containing additional arguments for the event.
   */
  function EventPacket( event, data) {
    var sequence = Packet.seq++;
    var packet = {
        "seq": sequence,
        "type":	"event",
        "event": event,
    };
    for (var prop in data) {
      packet[prop] = data[prop];
    }
    var json = this.toJSON(packet);
    this.data = this.toPacketString(json);
    this.length = this.data.length;
  };

  EventPacket.prototype = Packet;

  // ----- RequestPacket -----
  /**
   * @description Creates a Request Packet object.
   * @param packetString The unprocessed UTF-8 packet string.
   */
  function RequestPacket( packetString) {
    var unchunked = this.parsePacketString(packetString);
    var json = this.parseJSON(unchunked);
    for (var prop in json) {
      this[prop] = json[prop];
    }
    if (json.seq)
      Packet.seq = json.seq+1;
  };

  RequestPacket.prototype = Packet;

  // ----- ResponsePacket -----
  /**
   * @description Creates a new Response Packet object.
   *
   * @param command The name of the command that requested the response.
   * @param requestSeq The sequence number of the request that initiated this response.
   * @param body The JSON body of the response.
   * @param running boolean indicating whether the context is still running after the command.
   * @param success boolean indicating whether the command was succesful.
   */
  function ResponsePacket( command, requestSeq, body, running, success) {
    var sequence = Packet.seq++;
    var packet = {
        "seq": sequence,
        "type":	"response",
        "command": command,
        "request_seq": requestSeq,
        "body": body,
        "running": running,
        "success": success
    };

    var json = this.toJSON(packet);
    this.data = this.toPacketString(json);
    this.length = this.data.length;
  };

  ResponsePacket.prototype = Packet;
