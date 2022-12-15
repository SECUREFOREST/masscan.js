function Range(begin, end) {
  if (typeof begin == "undefined" && typeof end == "undefined") {
    this.begin = 0xffffffff;
    this.end = 0;
  } else if (typeof end == "undefined") {
    this.begin = begin;
    this.end = begin;
  } else {
    this.begin = begin;
    this.end = end;
  }
  this.toString = function () {
    return (
      ((this.begin >> 24) & 0xff) +
      "." +
      ((this.begin >> 16) & 0xff) +
      "." +
      ((this.begin >> 8) & 0xff) +
      "." +
      ((this.begin >> 0) & 0xff) +
      "-" +
      ((this.end >> 24) & 0xff) +
      "." +
      ((this.end >> 16) & 0xff) +
      "." +
      ((this.end >> 8) & 0xff) +
      "." +
      ((this.end >> 0) & 0xff)
    );
  };
  this.count = function () {
    return this.end - this.begin + 1;
  };
  this.pick = function (index) {
    return this.begin + index;
  };
  return this;
}
function RangeList() {
  this.list = [];
  this.total_count = 0;
  this.push = function (range) {
    this.list.push(range);
    this.total_count += range.count();
  };
  this.count = function () {
    return this.total_count;
  };
  this.pick = function (index) {
    for (var i in this.list) {
      var item = this.list[i];
      if (index < item.count()) return item.pick(index);
      else index -= item.count();
    }
    return null;
  };
}
function Targets() {
  this.ports = new RangeList();
  this.ips = new RangeList();
  this.parse_ip = function (text) {
    var x = text.split(".");
    var result = 0;
    result |= parseInt(x[0]) << 24;
    result |= parseInt(x[1]) << 16;
    result |= parseInt(x[2]) << 8;
    result |= parseInt(x[3]) << 0;
    return result;
  };
  this.parse_ports = function (arg) {
    var offset = 0;
    if (arg.indexOf(":") !== -1) {
      var x = arg.split(":");
      if (x[0] == "U") offset = 65536;
      else if (x[0] == "S") offset = 65536 * 2;
      arg = x[1];
    }
    var target;
    if (arg.indexOf("-") !== -1) {
      var x = arg.split("-");
      target = new Range(parseInt(x[0]), parseInt(x[1]));
    } else target = new Range(parseInt(arg));
    target.begin += offset;
    target.end += offset;
    this.ports.push(target);
  };
  this.parse_args = function (argv) {
    for (var i in argv) {
      var arg = argv[i];
      if (arg.indexOf(",") !== -1) {
        var x = arg.split(",");
        for (var j in x) this.parse_ports(x[j]);
      } else if (arg.indexOf("/") !== -1) {
        var x = arg.split("/");
        var address = this.parse_ip(x[0]);
        var prefix = parseInt(x[1]);
        var mask = 0xffffffff << (32 - prefix);
        address = address & mask;
        var target = new Range(address, address | ~mask);
        this.ips.push(target);
      } else if (arg.indexOf("-") !== -1) {
        var x = arg.split("-");
        var begin = this.parse_ip(x[0]);
        var end = this.parse_ip(x[1]);
        var target = new Range(begin, end);
        this.ips.push(target);
      } else if (arg.indexOf(".") !== -1) {
        var target = new Range(this.parse_ip(arg));
        this.ips.push(target);
      } else {
        this.parse_ports(arg);
      }
    }
  };
  this.print = function () {
    var i;
    for (i in this.ips.list) {
      console.log(this.ips.list[i].toString());
    }
    for (i in this.ports.list) {
      console.log(this.ports.list[i].toString());
    }
  };
  return this;
}
function Blackrock(range, seed) {
  var split = Math.floor(Math.sqrt(range * 1.0));
  this.rounds = 3;
  this.seed = seed;
  this.range = range;
  this.a = split - 1;
  this.b = split + 1;
  while (this.a * this.b <= range) this.b++;
  /** Inner permutation function */
  this.F = function (j, R, seed) {
    var primes = [961752031, 982324657, 15485843, 961752031];
    R = (R << (R & 0x4)) + R + seed;
    return Math.abs(((primes[j] * R + 25) ^ R) + j);
  };
  /** Outer feistal construction */
  this.fe = function (r, a, b, m, seed) {
    var L, R;
    var j;
    var tmp;
    L = m % a;
    R = Math.floor(m / a);
    for (j = 1; j <= r; j++) {
      if (j & 1) {
        tmp = (L + this.F(j, R, seed)) % a;
      } else {
        tmp = (L + this.F(j, R, seed)) % b;
      }
      L = R;
      R = tmp;
    }
    if (r & 1) {
      return a * L + R;
    } else {
      return a * R + L;
    }
  };
  /** Outer reverse feistal construction */
  this.unfe = function (r, a, b, m, seed) {
    var L, R;
    var j;
    var tmp;
    if (r & 1) {
      R = m % a;
      L = Math.floor(m / a);
    } else {
      L = m % a;
      R = Math.floor(m / a);
    }
    for (j = r; j >= 1; j--) {
      if (j & 1) {
        tmp = this.F(j, L, seed);
        if (tmp > R) {
          tmp = tmp - R;
          tmp = a - (tmp % a);
          if (tmp == a) tmp = 0;
        } else {
          tmp = R - tmp;
          tmp %= a;
        }
      } else {
        tmp = this.F(j, L, seed);
        if (tmp > R) {
          tmp = tmp - R;
          tmp = b - (tmp % b);
          if (tmp == b) tmp = 0;
        } else {
          tmp = R - tmp;
          tmp %= b;
        }
      }
      R = L;
      L = tmp;
    }
    return a * R + L;
  };
  this.shuffle = function (m) {
    var c;
    c = this.fe(this.rounds, this.a, this.b, m, this.seed);
    while (c >= this.range)
      c = this.fe(this.rounds, this.a, this.b, c, this.seed);
    return c;
  };
  this.unshuffle = function (m) {
    var c;
    c = unfe(this.rounds, this.a, this.b, m, this.seed);
    while (c >= this.range) c = unfe(this.rounds, this.a, this.b, c, this.seed);
    return c;
  };
  return this;
}
function TransmitThread(targets, transmit, seed) {
  var range = targets.ips.count() * targets.ports.count();
  var b = Blackrock(range, seed);
  for (var i = 0; i < range; i++) {
    var xXx = b.shuffle(i);
    var ip_index = Math.floor(xXx / targets.ports.count());
    var port_index = Math.floor(xXx % targets.ports.count());
    var ip = targets.ips.pick(ip_index);
    var port = targets.ports.pick(port_index);
    transmit(ip, port);
  }
}
function Transmit2Thread(targets, transmit, seed, start, stop, increment) {
  var range = targets.ips.count() * targets.ports.count();
  var b = Blackrock(range, seed);
  for (var i = start; i < range && i < stop; i += increment) {
    var xXx = b.shuffle(i);
    var ip_index = Math.floor(xXx / targets.ports.count());
    var port_index = Math.floor(xXx % targets.ports.count());
    var ip = targets.ips.pick(ip_index);
    var port = targets.ports.pick(port_index);
    transmit(ip, port);
  }
}
function transmit(ip, port) {
  var proto = "tcp";
  if (port > 65536 * 2) {
    proto = "sctp";
    port -= 65536 * 2;
  } else if (port > 65536) {
    proto = "udp";
    port -= 65536;
  }
  var ipstring =
    ((ip >> 24) & 0xff) +
    "." +
    ((ip >> 16) & 0xff) +
    "." +
    ((ip >> 8) & 0xff) +
    "." +
    ((ip >> 0) & 0xff);
  console.log("--> " + ipstring + " " + proto + ":" + port);
}
var targets = new Targets();
targets.parse_args(process.argv.splice(2));
targets.print();
TransmitThread(targets, transmit, 42);
