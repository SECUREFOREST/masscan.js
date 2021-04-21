# masscan.js
This is an implementation of the core Masscan scanning algorithm in JavaScript/NodeJS.
The core scanning algorithm is what makes Masscan unique from other scanners, so it's worth highlighting separately in a sample program.
* REVIEW OF SCANNERS  
The most famous port-scanner is "nmap". However, it is a "host-at-a-time" scanner, and struggles at scanning large networks. 
Masscan is an asynchronous, probe-at-a-time scanner. It spews out probes to different ports, without caring if two probes happen to be send to the same host. If the user wants a list of all ports open on a single host, they have to post-process the masscan output themselves, because masscan doesn't do it.
There are other asynchronous port-scanners, like scanrand, unicornscan, and zmap. However, they have limitations in the way they do randomization of their scans. 
They have limitations on the ranges of addresses and ports that they'll accept, try to store an individual memory record for everything scanned, or only partly randomize their scans.
* THE WAY MASSCAN WORKS  
Masscan first stores the targets as a "list of ranges". IP address ranges are stored in one structure, and port ranges are stored in another structure.
Then, a single index variable is used to enumerate the set of all IP:port combinations. The scan works by simply incrementing the index variable from 0 to the total number of probes (the 'range').
Then, before the enumeration step, the index is permuted into another random index within the same range, in a 1-to-1 mapping. In other words, the algorithm is theoretically reversable: given the output of the permutation function, we can obtain the original index.
* EXAMPLE  
This program can be run like the following:
node patent.js 10.0.0.0-10.0.0.5 192.168.0.0/31 80,U:161
10.0.0.0-10.0.0.5
192.168.0.0-192.168.0.1
0.0.0.80-0.0.0.80
0.1.0.161-0.1.0.161
--> 10.0.0.4 udp:161
--> 10.0.0.0 udp:161
--> 10.0.0.1 udp:161
--> 10.0.0.4 tcp:80
--> 192.168.0.1 tcp:80
--> 10.0.0.0 tcp:80
--> 10.0.0.2 udp:161
--> 10.0.0.5 udp:161
--> 192.168.0.0 tcp:80
--> 192.168.0.0 udp:161
--> 10.0.0.1 tcp:80
--> 10.0.0.3 udp:161
--> 10.0.0.2 tcp:80
--> 10.0.0.5 tcp:80
--> 192.168.0.1 udp:161
--> 10.0.0.3 tcp:80
What you see first is the target ranges being echoed back that it scans, first the IP address ranges, followed by the port ranges. The port ranges are in weird decimal-dot notation because they share the same code as for IPv4 addresses.
Then we see the randomized output, where individual probes are sent to a random IP address and port. 
* TransmitThread. 
All the majic happens in the "TransmitThread()" function near the bottom of this file.
We first see how the index variable 'i' is incremented from 0 to the total number of packets that will be sent. We then see how first this index is permuted to 'xXx', then this variable is separated into one index for the IP address and another index for the port. Then, those indexes are used to enumerate one of the IP addresses and one of the ports.
* Blackrock  
This is the permutation function. It implements an encryption algorithm based on DES (Data Encryption Standard). However, the use of real DES would impose a restricting on the range that it be an even power of 2.
In the above example, with 14 total probes, this doesn't apply.
Therefore, we have to change binary operators like XOR with their non-binary equivelents.
The upshot is that we first initialize Blackrock with the range (and a seed/key), and then shuffle the index. The process is stateless, meaning that any time we shuffle the number '5' we always get the same result, regardless of what has happened before.
Targets, RangeList, Range
A Range is just a begin/end of an integer. 
We use this both for IPv4 addresses (which are just 32-bit integers) and ports (which are 16 bit integers).
A RangeList is just an array of Ranges. In Masscan, this object sorts and combines ranges, making sure there are no duplicates, but that isn't used in this example.
The RangeList object shows how an index can enumerate the individual addresses/ports. This is down by walking the list and subtracting from the index the size of each range, until we reach a range that is larger than the index.
The Targets object just holds both the IP and port lists.
