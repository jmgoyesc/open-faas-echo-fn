const axios = require("axios");

let config = {
    maxBodyLength: Infinity,
    baseURL: "http://52.59.189.134:7001",
    headers: {},
};

const cred_def_id = "6i7GFi2cDx524ZNfxmGWcp:3:CL:12:default";
const issuer_did = "6i7GFi2cDx524ZNfxmGWcp";
const issuer_schema_id = "6i7GFi2cDx524ZNfxmGWcp:2:docker-vc:1.0";

const getConnectionId = async () => {
    const response = await axios.get("/connections", config);
    return response.data.results.find((it) => it.their_label === "Issuer")
        .connection_id;
};

const sendProposal = async (proposal) => {
    const data = {
        auto_remove: true,
        comment:
            "Proposal to create new OpenFaas function and upload to container registry",
        connection_id: proposal.connection_id,
        cred_def_id: proposal.cred_def_id,
        credential_proposal: {
            "@type": "issue-credential/1.0/credential-preview",
            attributes: [
                {
                    "mime-type": "application/json",
                    name: "namespace",
                    value: proposal.namespace,
                },
                {
                    "mime-type": "application/json",
                    name: "repository",
                    value: proposal.repository,
                },
                {
                    "mime-type": "application/json",
                    name: "tag",
                    value: proposal.tag,
                },
                {
                    "mime-type": "application/json",
                    name: "digest",
                    value: proposal.digest,
                },
            ],
        },
        issuer_did: proposal.issuer_did,
        schema_id: proposal.issuer_schema_id,
        schema_issuer_did: proposal.issuer_did,
        schema_name: "docker-vc",
        schema_version: "1.0",
        trace: true,
    };
    const response = await axios.post(
        `/issue-credential/send-proposal`,
        data,
        config
    );
    return {
        credential_exchange_id: response.data.credential_exchange_id,
        thread_id: response.data.thread_id,
    };
};

const getProposalRecords = async (
    connection_id,
    credential_exchange_id,
    state
) => {
    const response = await axios.get(
        `/issue-credential/records?connection_id=${connection_id}&role=holder&state=${state}`,
        config
    );
    return response.data.results.find((it) => it.connection_id === connection_id);
};

const waitForProposalRecords = async (
    connection_id,
    credential_exchange_id,
    state
) => {
    let offerReceived = await getProposalRecords(
        connection_id,
        credential_exchange_id,
        state
    );
    while (!offerReceived) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        console.log("finding record with state: " + state + "...");
        offerReceived = await getProposalRecords(
            connection_id,
            credential_exchange_id,
            state
        );
    }
    return offerReceived.credential_exchange_id;
};

const waitForOfferReceived = async (connection_id, credential_exchange_id) => {
    return await waitForProposalRecords(
        connection_id,
        credential_exchange_id,
        "offer_received"
    );
};

const confirmOffer = async (credential_exchange_id) => {
    await axios.post(
        `/issue-credential/records/${credential_exchange_id}/send-request`,
        null,
        config
    );
};

const waitForCredentialReceived = async (
    connection_id,
    credential_exchange_id
) => {
    return await waitForProposalRecords(
        connection_id,
        credential_exchange_id,
        "credential_received"
    );
};

const storeCredential = async (credential_exchange_id) => {
    const data = {
        credential_id: "jmgoyesc/open-faas-fn-echo_{{tag}}",
    };
    await axios.post(
        `/issue-credential/records/${credential_exchange_id}/store`,
        data,
        config
    );
};

const main = async () => {
    const connection_id = await getConnectionId();
    const proposal = {
        connection_id,
        cred_def_id: cred_def_id,
        issuer_did: issuer_did,
        issuer_schema_id: issuer_schema_id,
        namespace: "jmgoyesc",
        repository: "open-faas-fn-echo",
        tag: "0.0.2",
        digest:
            "sha256:4c5b5e9f8a8c3c1e2d3e4a5b6f7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6",
    };
    let { credential_exchange_id } = await sendProposal(proposal);
    console.log("initial credential exchange id: " + credential_exchange_id);
    credential_exchange_id = await waitForOfferReceived(
        connection_id,
        credential_exchange_id
    );

    console.log(
        "credential exchange id once offer recieved: " + credential_exchange_id
    );

    await confirmOffer(credential_exchange_id);
    console.log(
        "credential exchange id:  once offer confirmed" + credential_exchange_id
    );

    credential_exchange_id = await waitForCredentialReceived(
        connection_id,
        credential_exchange_id
    );

    await storeCredential(credential_exchange_id);
};

main()
    .then(() => console.log("Done"))
    .catch((err) => console.error(err));