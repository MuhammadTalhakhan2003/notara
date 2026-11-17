// The built-in study pack for Exam Coach: original study notes written for this demo,
// covering networking topics from the CompTIA A+ Core 1 exam objectives.

export const SAMPLE_TITLE = "Networking Essentials: CompTIA A+ Core 1 study notes";

export const SAMPLE_CONTENT = `Ports and protocols

TCP and UDP are the two main transport protocols. TCP is connection-oriented: before any data is sent, the two hosts complete a three-way handshake (SYN, SYN-ACK, ACK), and every segment is acknowledged, so lost data is retransmitted. UDP is connectionless: it sends datagrams without a handshake or acknowledgements, which makes it faster and lighter but unreliable. Streaming, VoIP and DNS lookups commonly use UDP because speed matters more than retransmitting a lost packet.

File transfer and remote access ports: FTP uses TCP ports 20 (data) and 21 (control). SSH uses TCP port 22 and provides an encrypted remote command line; SFTP also runs over SSH on port 22. Telnet uses TCP port 23 and sends everything, including passwords, in clear text, so it should be replaced by SSH. Remote Desktop Protocol (RDP) uses TCP port 3389 to give a graphical remote session to a Windows computer.

Email ports: SMTP uses TCP port 25 to send mail between servers. POP3 uses TCP port 110 and normally downloads messages to one device and removes them from the server. IMAP uses TCP port 143 and keeps messages on the server, so the same mailbox stays in sync across several devices.

Web and directory ports: HTTP uses TCP port 80 and HTTPS uses TCP port 443, which encrypts web traffic with TLS. DNS uses port 53 over UDP for most queries and over TCP for large responses and zone transfers. LDAP uses port 389 to query directory services such as Active Directory. SMB, used for Windows file and printer sharing, runs directly over TCP port 445; older NetBIOS-based sharing used ports 137 to 139.

Management ports: DHCP uses UDP ports 67 (server) and 68 (client). TFTP uses UDP port 69 and is a simple file transfer with no authentication, often used to load firmware or configuration files onto network devices. SNMP uses UDP port 161 for queries to managed devices and UDP port 162 for traps, which are alerts sent by devices to the management station.

IP addressing

An IPv4 address is 32 bits long, written as four decimal octets such as 192.168.1.10. The subnet mask, such as 255.255.255.0 (/24), separates the network portion of the address from the host portion. The default gateway is the router address a host sends traffic to when the destination is on a different network.

Private IPv4 ranges are reserved for internal networks and are not routed on the public internet: 10.0.0.0/8, 172.16.0.0/12 (172.16.0.0 to 172.31.255.255) and 192.168.0.0/16. A router performing NAT (Network Address Translation) lets many devices with private addresses share one public IP address.

If a Windows client cannot reach a DHCP server, it assigns itself an APIPA address in the 169.254.0.0/16 range. An address starting with 169.254 is therefore a strong sign that DHCP failed; the device can only talk to other APIPA devices on the same local segment and cannot reach the internet. The loopback address 127.0.0.1 always refers to the local machine and is used to test the computer's own TCP/IP stack.

IPv6 addresses are 128 bits long and written as eight groups of hexadecimal digits separated by colons. Leading zeros in a group can be dropped, and one run of consecutive all-zero groups can be replaced with a double colon (::). The IPv6 loopback address is ::1. Addresses beginning with fe80:: are link-local addresses, which every IPv6 interface creates automatically and which work only on the local segment.

DHCP and DNS

DHCP automatically gives clients an IP address, subnet mask, default gateway and DNS server addresses. The lease process has four steps, remembered as DORA: Discover (the client broadcasts to find a server), Offer (a server offers an address), Request (the client asks for the offered address) and Acknowledge (the server confirms the lease). The scope is the pool of addresses a DHCP server can hand out, and an exclusion keeps certain addresses out of that pool. A reservation ties a specific IP address to a device's MAC address, so a printer or server always receives the same address while still being managed by DHCP.

DNS translates host names into IP addresses. An A record maps a name to an IPv4 address, and an AAAA record maps a name to an IPv6 address. A CNAME record is an alias that points one name to another name. An MX record identifies the mail server that accepts email for a domain. TXT records hold text and are used for email authentication: SPF lists the servers allowed to send mail for the domain, DKIM publishes a public key used to verify message signatures, and DMARC tells receiving servers what to do with messages that fail those checks.

Wireless networking

The 802.11 standards define Wi-Fi. 802.11a uses the 5 GHz band at up to 54 Mbps, and 802.11b uses 2.4 GHz at up to 11 Mbps. 802.11g also uses 2.4 GHz but reaches 54 Mbps. 802.11n (Wi-Fi 4) works on both 2.4 GHz and 5 GHz and introduced MIMO, using multiple antennas to increase throughput. 802.11ac (Wi-Fi 5) operates on 5 GHz and added downstream MU-MIMO. 802.11ax (Wi-Fi 6) works on 2.4 GHz and 5 GHz and improves performance in crowded areas; Wi-Fi 6E extends 802.11ax into the 6 GHz band.

The 2.4 GHz band travels farther and passes through walls better, but it is more crowded and slower. The 5 GHz band offers more channels and higher speeds but has a shorter range. In the 2.4 GHz band, channels 1, 6 and 11 are the only non-overlapping channels in North America, so neighbouring access points should use different channels from that set to avoid interference.

Wireless security: WEP and the original WPA (TKIP) are outdated and should not be used. WPA2 uses AES encryption and is still widely deployed. WPA3 replaces the WPA2 pre-shared key exchange with SAE (Simultaneous Authentication of Equals), which protects against offline password-guessing attacks. In businesses, WPA2-Enterprise or WPA3-Enterprise authenticates each user individually against a RADIUS server instead of using one shared password.

Cables and connectors

Twisted-pair Ethernet cables use RJ45 connectors and are wired using the T568A or T568B standard. A straight-through cable has the same standard on both ends; a crossover cable has T568A on one end and T568B on the other, although most modern devices detect and correct this automatically (auto-MDIX). Category 5e supports 1 Gbps up to 100 metres. Category 6 supports 10 Gbps, but only up to about 55 metres; Category 6a supports 10 Gbps for the full 100 metres. Plenum-rated cable has a fire-resistant jacket that produces less toxic smoke and is required in air-handling spaces such as above drop ceilings.

Fiber optic cable carries light instead of electrical signals, so it is immune to electromagnetic interference. Single-mode fiber uses a very thin core and a laser to carry signals over long distances, many kilometres. Multimode fiber has a wider core, is usually driven by LEDs or cheaper lasers and is used for shorter runs, such as within a building. Common fiber connectors include LC, SC and ST. Coaxial cable, such as RG-6, is used for cable TV and cable internet and uses F-type connectors.

Network devices

A hub is a Layer 1 device that repeats every incoming signal out of every port, so all connected devices share the same bandwidth and collisions are common. A switch is a Layer 2 device that learns the MAC addresses of connected devices and forwards each frame only to the port where the destination is located. A managed switch can be configured, for example to create VLANs, which split one physical switch into separate logical networks. A router is a Layer 3 device that forwards packets between different networks using IP addresses.

Power over Ethernet (PoE) delivers electrical power and data over the same twisted-pair cable, which is useful for access points, IP phones and security cameras. 802.3af (PoE) provides up to 15.4 watts per port, 802.3at (PoE+) up to 30 watts, and 802.3bt (PoE++) up to 60 or 90 watts. A PoE injector can add power to a single cable when the switch itself does not support PoE.

Troubleshooting tools

Command-line tools: ping tests whether a host is reachable and measures round-trip time. ipconfig shows a Windows computer's IP configuration; ipconfig /release and ipconfig /renew request a new DHCP lease, and ipconfig /flushdns clears the local DNS cache. tracert (traceroute on Linux and macOS) lists each router hop between the computer and a destination, which helps locate where a connection fails. nslookup queries DNS servers directly to check name resolution. netstat lists active connections and listening ports.

Hardware tools: a cable tester checks a twisted-pair cable for open wires, shorts and miswiring. A toner probe (tone generator and probe) traces a cable through walls or finds which cable in a patch panel belongs to a wall jack. A loopback plug tests a network port by sending its signal back to itself. A crimper attaches RJ45 connectors to the end of a cable, and a punchdown tool seats wires into a patch panel or keystone jack. A Wi-Fi analyzer shows nearby wireless networks, their channels and signal strength, which helps choose the least crowded channel.
`;
