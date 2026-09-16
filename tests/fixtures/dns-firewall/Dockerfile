# Disposable firewall used by tests/e2e/api/policy/dns-install.e2e.spec.ts to install
# FWCloud policies through the SSH communication. Ubuntu 24.04 ships iptables v1.8.10 (nf_tables).
# The same image runs the DNS server (dnsmasq) the firewall uses, so resolution goes through the network.
FROM ubuntu:24.04

RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      openssh-server iptables iproute2 kmod procps dnsmasq-base && \
    rm -rf /var/lib/apt/lists/* /etc/ssh/ssh_host_* && \
    mkdir -p /run/sshd && \
    printf 'PermitRootLogin yes\nPasswordAuthentication yes\nUsePAM no\n' > /etc/ssh/sshd_config.d/fwcloud-test.conf && \
    echo 'root:fwcloud-test' | chpasswd

# The policy script looks for NAT kernel modules under the running kernel's module directory.
CMD ["sh", "-c", "ssh-keygen -A && mkdir -p /lib/modules/$(uname -r)/kernel/net && exec /usr/sbin/sshd -D -e"]
