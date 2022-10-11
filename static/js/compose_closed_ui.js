import $ from "jquery";

import * as compose_actions from "./compose_actions";
import {$t} from "./i18n";
import * as message_lists from "./message_lists";
import * as message_store from "./message_store";
import * as narrow_state from "./narrow_state";
import * as people from "./people";
import * as recent_topics_util from "./recent_topics_util";

export function get_recipient_label(message) {
    // TODO: This code path is bit of a type-checking disaster; we mix
    // actual message objects with fake objects containing just a
    // couple fields, both those constructed here and potentially
    // passed in.

    if (message === undefined) {
        if (message_lists.current.empty()) {
            // For empty narrows where there's a clear reply target,
            // i.e. stream+topic or a single PM conversation, we label
            // the button as replying to the thread.
            if (narrow_state.narrowed_to_topic()) {
                message = {
                    stream: narrow_state.stream(),
                    topic: narrow_state.topic(),
                };
            } else if (narrow_state.pm_ids_string()) {
                // TODO: This is a total hack.  Ideally, we'd rework
                // this to not duplicate the actual compose_actions.js
                // logic for what happens when you click the button,
                // and not call into random modules with hacky fake
                // "message" objects.
                const user_ids = people.user_ids_string_to_ids_array(narrow_state.pm_ids_string());
                const user_ids_dicts = user_ids.map((user_id) => ({id: user_id}));
                message = {
                    display_reply_to: message_store.get_pm_full_names({
                        type: "private",
                        display_recipient: user_ids_dicts,
                    }),
                };
            }
        } else {
            message = message_lists.current.selected_message();
        }
    }

    if (message) {
        if (message.stream && message.topic) {
            return "#" + message.stream + " > " + message.topic;
        } else if (message.display_reply_to) {
            return message.display_reply_to;
        }
    }
    return "";
}

function update_stream_button(btn_text, title) {
    $("#left_bar_compose_stream_button_big").text(btn_text);
    $("#left_bar_compose_stream_button_big").prop("title", title);
}

function update_conversation_button(btn_text, title) {
    $("#left_bar_compose_private_button_big").text(btn_text);
    $("#left_bar_compose_private_button_big").prop("title", title);
}

function update_buttons(text_stream) {
    const title_stream = text_stream + " (c)";
    const text_conversation = $t({defaultMessage: "New private message"});
    const title_conversation = text_conversation + " (x)";
    update_stream_button(text_stream, title_stream);
    update_conversation_button(text_conversation, title_conversation);
}

// disable compose box reply button, when the recipient is a deactivated user.
function update_reply_button_disable_status(disable = false, title) {
    $(".compose_reply_button").attr("disabled", disable);
    if (!title) {
        const title_text = $t({defaultMessage: "Reply to selected message"});
        title = title_text + " (r)";
    }
    $(".compose_reply_button").prop("title", title);
}

export function update_buttons_for_private() {
    const text_stream = $t({defaultMessage: "New stream message"});
    update_buttons(text_stream);
}

export function update_buttons_for_stream() {
    const text_stream = $t({defaultMessage: "New topic"});
    update_buttons(text_stream);
}

// disable the reply button if the recipient is a deactivated user,
// there are two different ways to get the ids of the recipient,
// one is to get it from narrow_state for pm other is to get the
// id from the selected_message, this is useful for all message narrow.
// selected_message.display_recipient is an array in case of pm,
// it is a string in case of stream/topic
function update_reply_button_deactivated_users() {
    if (narrow_state.pm_ids_string()) {
        const check_user_is_deactivated = compose_actions.check_pm_deactivated(
            narrow_state.pm_ids_string(),
            false,
        );
        if (check_user_is_deactivated.is_user_id_deactivated) {
            const disable_reply = true;
            let title_reply;
            if (check_user_is_deactivated.user_ids_length === 1) {
                title_reply = $t({
                    defaultMessage: "Cannot send message to a deactivated user.",
                });
            } else {
                title_reply = $t({
                    defaultMessage:
                        "Cannot send a message to a group that contains a deactivated user.",
                });
            }
            return update_reply_button_disable_status(disable_reply, title_reply);
        }
    } else if (
        message_lists.current.selected_message() &&
        Array.isArray(message_lists.current.selected_message().display_recipient)
    ) {
        const ids_array = message_lists.current
            .selected_message()
            .display_recipient.map((object) => object.id);
        const check_user_is_deactivated = compose_actions.check_pm_deactivated(false, ids_array);
        if (check_user_is_deactivated.is_user_id_deactivated) {
            const disable_reply = true;
            let title_reply;
            if (check_user_is_deactivated.user_ids_length < 3) {
                title_reply = $t({
                    defaultMessage: "Cannot send message to a deactivated user.",
                });
            } else {
                title_reply = $t({
                    defaultMessage:
                        "Cannot send a message to a group that contains a deactivated user.",
                });
            }
            return update_reply_button_disable_status(disable_reply, title_reply);
        }
    }
    return update_reply_button_disable_status();
}

export function update_buttons_for_recent_topics() {
    const text_stream = $t({defaultMessage: "New stream message"});
    update_buttons(text_stream);
}

function set_reply_button_label(label) {
    $(".compose_reply_button_label").text(label);
}

export function set_standard_text_for_reply_button() {
    set_reply_button_label($t({defaultMessage: "Compose message"}));
}

export function update_reply_recipient_label(message) {
    // Change the reply button status whenever the recipient_label changes.
    update_reply_button_deactivated_users();
    const recipient_label = get_recipient_label(message);
    if (recipient_label) {
        set_reply_button_label(
            $t({defaultMessage: "Message {recipient_label}"}, {recipient_label}),
        );
    } else {
        set_standard_text_for_reply_button();
    }
}

export function initialize() {
    // When the message selection changes, change the label on the Reply button.
    $(document).on("message_selected.zulip", () => {
        if (recent_topics_util.is_visible()) {
            // message_selected events can occur with recent topics
            // open due to "All messages" loading in the background,
            // so we return without calling changing button state.
            return;
        }

        update_reply_recipient_label();
    });

    // Click handlers for buttons in the compose box.
    $("body").on("click", ".compose_stream_button", () => {
        compose_actions.start("stream", {trigger: "new topic button"});
    });

    $("body").on("click", ".compose_private_button", () => {
        compose_actions.start("private", {trigger: "new private message"});
    });

    $("body").on("click", ".compose_reply_button", () => {
        compose_actions.respond_to_message({trigger: "reply button"});
    });
}
